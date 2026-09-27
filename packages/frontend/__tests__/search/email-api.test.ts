import { createEmailApi } from '@/services/emailApi';
import { wireMessage, wireOutbox } from '../fixtures/wire';

const message = wireMessage({ subject: 'Budget', flags: { seen: true, starred: false, answered: false, forwarded: false, draft: false, pinned: false } });

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
        .mockResolvedValueOnce([wireOutbox()])
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

  it('preserves immediate, queued, and scheduled delivery outcomes', async () => {
    const http = {
      post: jest.fn()
        .mockResolvedValueOnce({ messageId: '<sent@example.test>', queued: false, message: 'Message sent' })
        .mockResolvedValueOnce({ messageId: '<queued@example.test>', queued: true, message: 'Message queued for delivery' })
        .mockResolvedValueOnce({
          messageId: '<scheduled@example.test>',
          scheduledAt: '2026-02-01T12:00:00.000Z',
          message: 'Message scheduled for delivery',
        }),
    };
    const api = createEmailApi(http as never);
    const input = { to: [{ address: 'recipient@example.test' }], subject: 'Hello' };

    await expect(api.sendMessage(input)).resolves.toMatchObject({ queued: false });
    await expect(api.sendMessage(input)).resolves.toMatchObject({ queued: true });
    await expect(api.sendMessage(input)).resolves.toMatchObject({ scheduledAt: '2026-02-01T12:00:00.000Z' });
  });
});
