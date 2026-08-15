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
});
