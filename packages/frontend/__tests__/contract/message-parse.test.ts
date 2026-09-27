const recordInboxMetric = jest.fn();
jest.mock('@/utils/inboxTelemetry', () => ({ recordInboxMetric }));

import { createEmailApi } from '@/services/emailApi';

/**
 * The shape the API sent for a Ramp verification mail on 2026-09-27: its AMP
 * alternative arrives as an attachment with no Content-ID, which the API
 * serialises as `contentId: null`. The client schema rejected null, and the
 * whole message vanished from the inbox a second after it appeared.
 */
const ampMail = {
  _id: '01a0e16f-99bc-7f50-af45-9a9ca01a82ea',
  userId: 'user-1',
  mailboxId: 'inbox-1',
  messageId: '<code@geopod-ismtpd-9>',
  threadId: '01a0e16f-99bc-7f50-af45-9a9ca01a82ea',
  from: { name: 'Ramp', address: 'communications@ramp.com' },
  to: [{ name: '', address: 'nate@oxy.so' }],
  cc: [],
  bcc: [],
  subject: '977687 is your Ramp sign-in code',
  text: 'Your login verification code',
  html: null,
  attachments: [
    { fileId: 'file-1', name: 'attachment', contentType: 'text/x-amp-html', size: 22737, contentId: null, isInline: false },
  ],
  flags: { seen: false, starred: false, answered: false, forwarded: false, draft: false, pinned: false },
  labels: [],
  size: 40000,
  inReplyTo: null,
  references: [],
  date: '2026-09-27T05:56:22.000Z',
  receivedAt: '2026-09-27T05:56:22.583Z',
  createdAt: '2026-09-27T05:56:22.583Z',
  updatedAt: '2026-09-27T05:56:22.583Z',
};

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
    expect(thread).toHaveLength(1);
  });

  it('reports a row that breaks the contract instead of dropping it silently', async () => {
    const api = apiReturning({
      data: [ampMail, { ...ampMail, _id: 'broken', from: null }],
      pagination: { total: 2, limit: 50, offset: 0, hasMore: false },
    });
    const page = await api.listMessages({ mailboxId: 'inbox-1' });
    expect(page.data).toHaveLength(1);
    expect(recordInboxMetric).toHaveBeenCalledWith('message_parse_failed');
    expect(consoleError).toHaveBeenCalledWith(
      '[inbox] message failed schema validation',
      expect.objectContaining({ source: 'list', id: 'broken' }),
    );
  });
});
