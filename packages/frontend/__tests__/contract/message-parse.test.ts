const recordInboxMetric = jest.fn();
jest.mock('@/utils/inboxTelemetry', () => ({ recordInboxMetric }));

import { createEmailApi } from '@/services/emailApi';
import { ampAttachment, wireMessage } from '../fixtures/wire';

/**
 * The shape the API sent for a Ramp verification mail on 2026-09-27: its AMP
 * alternative arrives as an attachment with no Content-ID, which the API
 * serialises as `contentId: null`. The client schema rejected null, and the
 * whole message vanished from the inbox a second after it appeared.
 */
const ampMail = wireMessage({
  text: 'Your login verification code',
  html: null,
  attachments: [ampAttachment],
});

function apiReturning(body: unknown) {
  const http = { get: jest.fn().mockResolvedValue(body) };
  return createEmailApi(http as never);
}

describe('message list parsing', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    recordInboxMetric.mockClear();
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => consoleError.mockRestore());

  it('keeps a message whose attachment has contentId: null', async () => {
    const api = apiReturning({
      data: [ampMail],
      pagination: { total: 1, limit: 50, offset: 0, hasMore: false },
    });
    const page = await api.listMessages({ mailboxId: 'inbox-1' });
    expect(page.data.map((m) => m._id)).toEqual([ampMail._id]);
    expect(page.data[0].attachments[0].contentId).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('keeps it in a thread read too', async () => {
    const thread = await apiReturning([ampMail]).getThread(ampMail._id);
    expect(thread.messages).toHaveLength(1);
    expect(thread.unreadable).toEqual([]);
  });

  it('reports a row that breaks the contract and returns it as unreadable', async () => {
    const api = apiReturning({
      data: [ampMail, { ...ampMail, _id: 'broken', from: null }],
      pagination: { total: 2, limit: 50, offset: 0, hasMore: false },
    });
    const page = await api.listMessages({ mailboxId: 'inbox-1' });
    expect(page.data).toHaveLength(1);
    // Never dropped: it comes back as a distinct, degraded row.
    expect(page.unreadable).toEqual([
      {
        kind: 'unreadable',
        _id: 'broken',
        from: null,
        subject: ampMail.subject,
        receivedAt: ampMail.receivedAt,
      },
    ]);
    expect(recordInboxMetric).toHaveBeenCalledWith('message_parse_failed');
    expect(consoleError).toHaveBeenCalledWith(
      '[inbox] message failed schema validation',
      expect.objectContaining({ source: 'list', id: 'broken' }),
    );
  });
});

describe('single message read', () => {
  it('reports the failing fields before the detail screen shows its error', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const api = apiReturning({ ...ampMail, from: null });
    await expect(api.getMessage(ampMail._id)).rejects.toThrow();
    expect(consoleError).toHaveBeenCalledWith(
      '[inbox] message failed schema validation',
      expect.objectContaining({ source: 'detail', id: ampMail._id }),
    );
    consoleError.mockRestore();
  });
});

describe('sendMessage', () => {
  it('always sends the Idempotency-Key and a timeout that outlasts a synchronous relay', async () => {
    const post = jest.fn().mockResolvedValue({ messageId: '<a@oxy.so>', message: 'Message sent' });
    const api = createEmailApi({ post } as never);
    await api.sendMessage({
      to: [{ address: 'a@b.co' }],
      subject: 'Hi',
      idempotencyKey: 'inbox-send-k',
    });
    const [, payload, config] = post.mock.calls[0];
    expect(payload).not.toHaveProperty('idempotencyKey');
    expect(config.headers).toEqual({ 'Idempotency-Key': 'inbox-send-k' });
    expect(config.timeout).toBeGreaterThanOrEqual(30_000);
  });
});
