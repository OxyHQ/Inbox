/**
 * `useInboxSocket` — the hook that had no tests while it silently did nothing.
 *
 * Two regressions are pinned here:
 *
 *  1. **It no longer opens its own socket.** It used to call `io(baseURL, …)`
 *     behind `if (!userId || !activeSessionId || !canUsePrivateApi) return;`.
 *     `activeSessionId` is null whenever the device-session state has not
 *     loaded or the bound account has no session row on this device — while
 *     holding a perfectly good bearer — so on the web the socket frequently was
 *     never created, with no signal anywhere. It now rides the SDK's existing
 *     connection through `useOxyEvent`, which has no gate of its own to get
 *     wrong.
 *
 *  2. **`id` and `messageId` are different fields.** The server used to send
 *     the database row id in a field called `messageId`, and the optimistic
 *     insert deduped on it — comparing a row id against a real row's
 *     `<...@oxy.so>` header, which can never match, so every new mail rendered
 *     twice until the refetch landed.
 */

const handlers = new Map<string, (payload: unknown) => void>();
/** Deliver a socket event to the handler the hook registered for it. */
function emit(event: string, payload: unknown) {
  defined(handlers.get(event), `a handler for ${event}`)(payload);
}
const useOxyEvent = jest.fn((event: string, handler: (payload: unknown) => void) => {
  handlers.set(event, handler);
});

jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({ user: { id: 'user-1' } }),
  useOxyEvent: (event: string, handler: (payload: unknown) => void) => useOxyEvent(event, handler),
}));

const toast = { info: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn() };
jest.mock('@oxy.so/bloom', () => ({ toast }));

const setQueriesData = jest.fn();
const setQueryData = jest.fn();
const invalidateQueries = jest.fn();
let cachedMailboxes: unknown[] = [];
const getQueryData = jest.fn(() => cachedMailboxes);
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: () => ({ setQueriesData, setQueryData, invalidateQueries, getQueryData }),
}));

let viewMode: unknown = null;
const getMessage = jest.fn();
jest.mock('@/hooks/useEmail', () => ({
  useEmailStore: (selector: (s: unknown) => unknown) =>
    selector({ viewMode, _api: { getMessage } }),
}));

jest.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, string>) => `${key}:${vars?.sender ?? ''}`,
  }),
}));

let pathname = '/';
const push = jest.fn();
jest.mock('expo-router', () => ({ usePathname: () => pathname, useRouter: () => ({ push }) }));

const recordInboxMetric = jest.fn();
jest.mock('@/utils/inboxTelemetry', () => ({ recordInboxMetric }));

import { renderHook } from '@testing-library/react';
import { useInboxSocket } from '@/hooks/useInboxSocket';
import {
  __resetNewMailAttention,
  claimNewMailAnnouncement,
  noteSettingsOpen,
} from '@/lib/notifications/new-mail-attention';
import { defined } from '../fixtures/defined';

const emailNew = {
  id: 'row-abc',
  messageId: '<mime-xyz@example.com>',
  mailboxId: 'mb-1',
  folder: 'inbox',
  from: { name: 'Alice', address: 'alice@example.com' },
  subject: 'Hello',
  snippet: 'body',
  receivedAt: '2026-01-01T00:00:00.000Z',
  unread: true as const,
};

function mount() {
  handlers.clear();
  renderHook(() => useInboxSocket());
}

beforeEach(() => {
  jest.clearAllMocks();
  viewMode = null;
  pathname = '/';
  __resetNewMailAttention();
});

describe('subscription', () => {
  it('rides the SDK connection instead of opening a second socket', () => {
    mount();
    // No socket.io-client involvement at all: everything goes through the
    // SDK's already-authenticated connection.
    expect(useOxyEvent).toHaveBeenCalledTimes(3);
    expect([...handlers.keys()].sort()).toEqual([
      'email:changed',
      'email:new',
      'email:unread_count',
    ]);
  });
});

describe('email:new', () => {
  it('prepends using the ROW id, so the later refetch deduplicates', () => {
    mount();
    emit('email:new', emailNew);

    const updater = setQueriesData.mock.calls[0][1] as (old: unknown) => unknown;
    const next = updater({
      pages: [{ data: [{ _id: 'row-old', messageId: '<old@example.com>' }], pagination: {} }],
      pageParams: [],
    }) as { pages: { data: { _id: string; messageId: string }[] }[] };

    expect(next.pages[0].data[0]._id).toBe('row-abc');
    // The MIME header is carried through as itself, not as the id.
    expect(next.pages[0].data[0].messageId).toBe('<mime-xyz@example.com>');
  });

  it('does not insert a message the list already holds', () => {
    mount();
    emit('email:new', emailNew);

    const updater = setQueriesData.mock.calls[0][1] as (old: unknown) => unknown;
    const existing = {
      pages: [{ data: [{ _id: 'row-abc', messageId: '<mime-xyz@example.com>' }], pagination: {} }],
      pageParams: [],
    };
    // Same object back: the reconciling refetch and the optimistic insert race,
    // and the row must not appear twice.
    expect(updater(existing)).toBe(existing);
  });

  it('toasts when the user is looking at a different mailbox', () => {
    viewMode = { type: 'mailbox', mailbox: { _id: 'mb-OTHER' } };
    mount();
    emit('email:new', emailNew);
    expect(toast.info).toHaveBeenCalledWith('inbox.toast.newEmail:Alice');
  });

  it('stays quiet when the row is about to appear in front of them', () => {
    viewMode = { type: 'mailbox', mailbox: { _id: 'mb-1' } };
    mount();
    emit('email:new', emailNew);
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('toasts in Search even though the last folder browsed is where the mail landed', () => {
    // `viewMode` keeps the folder while Search is on screen; the list is not.
    viewMode = { type: 'mailbox', mailbox: { _id: 'mb-1' } };
    pathname = '/search';
    mount();
    emit('email:new', emailNew);
    expect(toast.info).toHaveBeenCalledWith('inbox.toast.newEmail:Alice');
  });

  it('toasts in Subscriptions too', () => {
    viewMode = { type: 'mailbox', mailbox: { _id: 'mb-1' } };
    pathname = '/subscriptions';
    mount();
    emit('email:new', emailNew);
    expect(toast.info).toHaveBeenCalledTimes(1);
  });

  it('toasts while the settings modal covers the list', () => {
    viewMode = { type: 'mailbox', mailbox: { _id: 'mb-1' } };
    noteSettingsOpen(true);
    mount();
    emit('email:new', emailNew);
    expect(toast.info).toHaveBeenCalledTimes(1);
  });

  it('does not toast a message whose push already showed the OS banner', () => {
    viewMode = { type: 'mailbox', mailbox: { _id: 'mb-OTHER' } };
    expect(claimNewMailAnnouncement(emailNew.id)).toBe(true); // the push got there first
    mount();
    emit('email:new', emailNew);
    expect(toast.info).not.toHaveBeenCalled();
    // The cache is still updated: only the announcement is deduplicated.
    expect(setQueriesData).toHaveBeenCalled();
  });

  it('claims the message, so a push arriving after it stays quiet', () => {
    mount();
    emit('email:new', emailNew);
    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(claimNewMailAnnouncement(emailNew.id)).toBe(false);
  });

  it('ignores a malformed payload instead of writing junk into the cache', () => {
    mount();
    emit('email:new', { id: 'row-abc' });
    expect(setQueriesData).not.toHaveBeenCalled();
    expect(recordInboxMetric).toHaveBeenCalledWith('realtime_malformed_event');
  });

  it('ignores a payload that carries no id, even if it looks otherwise valid', () => {
    mount();
    const { id: _dropped, ...withoutId } = emailNew;
    emit('email:new', withoutId);
    expect(setQueriesData).not.toHaveBeenCalled();
  });
});

describe('email:unread_count', () => {
  it('writes the server count over the optimistic one', () => {
    mount();
    emit('email:unread_count', { mailboxId: 'mb-1', unread: 4 });

    const updater = defined(setQueryData.mock.calls.at(-1))[1] as (old: unknown) => unknown;
    expect(updater([{ _id: 'mb-1', unseenMessages: 99 }])).toEqual([
      { _id: 'mb-1', unseenMessages: 4 },
    ]);
  });

  it('returns the same array when nothing changed, so nothing re-renders', () => {
    mount();
    emit('email:unread_count', { mailboxId: 'mb-1', unread: 4 });

    const updater = defined(setQueryData.mock.calls.at(-1))[1] as (old: unknown) => unknown;
    const unchanged = [{ _id: 'mb-1', unseenMessages: 4 }];
    expect(updater(unchanged)).toBe(unchanged);
  });

  it('ignores a malformed payload', () => {
    mount();
    emit('email:unread_count', { mailboxId: 'mb-1' });
    expect(setQueryData).not.toHaveBeenCalled();
  });
});

describe('email:changed', () => {
  it('reconciles every view that shows mail, not only the mailbox lists, once per burst', () => {
    jest.useFakeTimers();
    mount();
    // A draft sent from another device: it is deleted, and it may be open here,
    // in a conversation, in search results or in a bundle.
    for (let i = 0; i < 50; i++) {
      emit('email:changed', {
        id: `row-${i}`,
        mailboxIds: ['mb-drafts'],
        reason: 'deleted',
      });
    }
    expect(invalidateQueries).not.toHaveBeenCalled();
    jest.advanceTimersByTime(300);
    jest.useRealTimers();
    // One reconcile for the whole burst: six roots, once each.
    expect(invalidateQueries).toHaveBeenCalledTimes(6);
    const keys = invalidateQueries.mock.calls.map(
      ([filters]) => (filters as { queryKey: unknown[] }).queryKey[0],
    );
    expect(keys).toEqual(
      expect.arrayContaining(['messages', 'message', 'thread', 'search', 'bundles', 'mailboxes']),
    );
  });

  it('ignores a malformed payload', () => {
    mount();
    emit('email:changed', { id: 'row-1', mailboxIds: 'not-an-array', reason: 'moved' });
    expect(invalidateQueries).not.toHaveBeenCalled();
    expect(recordInboxMetric).toHaveBeenCalledWith('realtime_malformed_event');
  });
});

describe('email:changed — delivery', () => {
  const changed = { id: 'row-sent', mailboxIds: ['mb-sent'], reason: 'delivery' };
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('re-reads the message, and is quiet when it went out', async () => {
    getMessage.mockResolvedValue({
      _id: 'row-sent',
      subject: 'Re: Quota',
      delivery: { state: 'sent' },
    });
    mount();
    emit('email:changed', changed);
    await flush();

    expect(getMessage).toHaveBeenCalledWith('row-sent');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('says so, wherever the user is, when a message was not delivered', async () => {
    getMessage.mockResolvedValue({
      _id: 'row-sent',
      subject: 'Re: Quota',
      delivery: { state: 'failed' },
    });
    mount();
    emit('email:changed', changed);
    await flush();

    expect(toast.error).toHaveBeenCalledWith(
      'delivery.failedToast:',
      expect.objectContaining({ action: expect.objectContaining({ label: 'delivery.view:' }) }),
    );
    const { action } = toast.error.mock.calls[0][1] as { action: { onClick: () => void } };
    action.onClick();
    expect(push).toHaveBeenCalledWith('/conversation/row-sent');
  });

  it('is quiet for a message without a delivery, from a server that does not track it', async () => {
    getMessage.mockResolvedValue({ _id: 'row-sent', subject: 'Re: Quota' });
    mount();
    emit('email:changed', changed);
    await flush();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('reads nothing for other kinds of change', async () => {
    mount();
    emit('email:changed', { ...changed, reason: 'flags' });
    await flush();
    expect(getMessage).not.toHaveBeenCalled();
  });
});

describe('email:new into spam', () => {
  it('does not toast a sender whose mail was filed as spam', () => {
    cachedMailboxes = [{ _id: 'mb-junk', specialUse: '\\Junk' }];
    viewMode = null;
    mount();
    emit('email:new', { ...emailNew, mailboxId: 'mb-junk', folder: 'spam' });
    expect(toast.info).not.toHaveBeenCalled();
    cachedMailboxes = [];
  });
});
