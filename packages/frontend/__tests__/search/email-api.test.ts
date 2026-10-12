import { createEmailApi } from '@/services/emailApi';
import { wireDelivery, wireMessage } from '../fixtures/wire';

const message = wireMessage({
  subject: 'Budget',
  flags: {
    seen: true,
    starred: false,
    answered: false,
    forwarded: false,
    draft: false,
    pinned: false,
  },
});

describe('email search client contract', () => {
  it('sends every structured filter and preserves an explicit read=false state', async () => {
    const http = {
      get: jest.fn().mockResolvedValue({
        data: [message],
        pagination: { total: 1, limit: 50, offset: 50, hasMore: false },
      }),
    };
    const api = createEmailApi(http as never);

    await api.search({
      q: 'budget',
      from: 'alice',
      to: 'bob',
      subject: 'quarterly',
      hasAttachment: true,
      dateAfter: '2026-01-01',
      dateBefore: '2026-02-01',
      mailbox: 'mailbox-1',
      starred: true,
      unread: false,
      label: 'finance',
      limit: 50,
      offset: 50,
    });

    expect(http.get).toHaveBeenCalledWith('/email/search', {
      params: {
        q: 'is:read budget',
        from: 'alice',
        to: 'bob',
        subject: 'quarterly',
        hasAttachment: 'true',
        dateAfter: '2026-01-01',
        dateBefore: '2026-02-01',
        mailbox: 'mailbox-1',
        starred: 'true',
        label: 'finance',
        limit: '50',
        offset: '50',
      },
    });
  });

  it('validates saved-search responses', async () => {
    const http = {
      get: jest.fn().mockResolvedValueOnce([
        {
          id: 'saved-1',
          name: 'Unread finance',
          query: 'from:finance is:unread',
          filters: { from: 'finance', unread: true },
          order: 0,
          createdAt: '2026-01-02T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        },
      ]),
    };
    const api = createEmailApi(http as never);

    await expect(api.listSavedSearches()).resolves.toMatchObject([
      { name: 'Unread finance', filters: { unread: true } },
    ]);
    expect(http.get).toHaveBeenCalledWith('/email/saved-searches');
  });

  it('reads an accepted send and a scheduled one', async () => {
    const http = {
      post: jest
        .fn()
        .mockResolvedValueOnce({
          id: 'row-1',
          messageId: '<sent@example.test>',
          queued: false,
          delivery: wireDelivery({ state: 'sending', attempts: 1, error: null, errorCode: null }),
          message: 'Message accepted for delivery',
        })
        .mockResolvedValueOnce({
          messageId: '<scheduled@example.test>',
          scheduledAt: '2026-02-01T12:00:00.000Z',
          message: 'Message scheduled for delivery',
        }),
    };
    const api = createEmailApi(http as never);
    const input = {
      to: [{ address: 'recipient@example.test' }],
      subject: 'Hello',
      idempotencyKey: 'k',
    };

    await expect(api.sendMessage(input)).resolves.toMatchObject({
      id: 'row-1',
      delivery: { state: 'sending' },
    });
    await expect(api.sendMessage(input)).resolves.toMatchObject({
      scheduledAt: '2026-02-01T12:00:00.000Z',
    });
    expect(http.post).toHaveBeenCalledWith(
      '/email/messages',
      { to: input.to, subject: 'Hello' },
      expect.objectContaining({ headers: { 'Idempotency-Key': 'k' }, retry: true }),
    );
  });

  it('reads an accepted send from a server that does not report delivery', async () => {
    const http = {
      post: jest
        .fn()
        .mockResolvedValue({ messageId: '<old@example.test>', message: 'Message sent' }),
    };
    const api = createEmailApi(http as never);
    await expect(
      api.sendMessage({ to: [{ address: 'a@example.test' }], subject: 'Hi', idempotencyKey: 'k' }),
    ).resolves.toMatchObject({ messageId: '<old@example.test>' });
  });

  it('retries a failed delivery by message', async () => {
    const http = {
      post: jest.fn().mockResolvedValue(
        wireMessage({
          delivery: wireDelivery({ state: 'sending', attempts: 1, error: null, errorCode: null }),
        }),
      ),
    };
    const api = createEmailApi(http as never);
    await expect(api.retryDelivery('message-1')).resolves.toMatchObject({
      delivery: { state: 'sending' },
    });
    expect(http.post).toHaveBeenCalledWith('/email/messages/message-1/delivery/retry');
  });
});
