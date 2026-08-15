import { createEmailApi } from '@/services/emailApi';

const message = {
  _id: 'message-1',
  userId: 'user-1',
  mailboxId: 'mailbox-1',
  messageId: '<message-1@example.test>',
  from: { address: 'sender@example.test' },
  to: [],
  subject: 'Budget',
  attachments: [],
  flags: { seen: true },
  labels: [],
  size: 0,
  date: '2026-01-02T00:00:00.000Z',
  receivedAt: '2026-01-02T00:00:00.000Z',
};

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

  it('validates durable outbox and saved-search responses', async () => {
    const http = {
      get: jest.fn()
        .mockResolvedValueOnce([{
          id: 'outbox-1',
          messageId: '<outbox-1@example.test>',
          status: 'failed',
          attempts: 2,
          nextAttemptAt: '2026-01-02T00:00:00.000Z',
          lastError: 'relay unavailable',
          sentAt: null,
          createdAt: '2026-01-02T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        }])
        .mockResolvedValueOnce([{
          id: 'saved-1',
          name: 'Unread finance',
          query: 'from:finance is:unread',
          filters: { from: 'finance', unread: true },
          order: 0,
          createdAt: '2026-01-02T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        }]),
    };
    const api = createEmailApi(http as never);

    await expect(api.listOutboundMessages()).resolves.toHaveLength(1);
    await expect(api.listSavedSearches()).resolves.toMatchObject([
      { name: 'Unread finance', filters: { unread: true } },
    ]);
    expect(http.get).toHaveBeenNthCalledWith(1, '/email/outbox', { params: undefined });
    expect(http.get).toHaveBeenNthCalledWith(2, '/email/saved-searches');
  });
});
