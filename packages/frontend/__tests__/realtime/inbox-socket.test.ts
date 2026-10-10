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
const useOxyEvent = jest.fn((event: string, handler: (payload: unknown) => void) => {
  handlers.set(event, handler);
});

jest.mock('@oxy.so/services', () => ({
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
jest.mock('@/hooks/useEmail', () => ({
  useEmailStore: (selector: (s: unknown) => unknown) => selector({ viewMode }),
}));

jest.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string, vars?: Record<string, string>) => `${key}:${vars?.sender ?? ''}` }),
}));

let pathname = '/';
jest.mock('expo-router', () => ({ usePathname: () => pathname }));

const recordInboxMetric = jest.fn();
jest.mock('@/utils/inboxTelemetry', () => ({ recordInboxMetric }));

import { renderHook } from '@testing-library/react';
import { useInboxSocket } from '@/hooks/useInboxSocket';
import {
  __resetNewMailAttention,
  claimNewMailAnnouncement,
  noteSettingsOpen,
} from '@/lib/notifications/new-mail-attention';

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
    expect([...handlers.keys()].sort()).toEqual(['email:changed', 'email:new', 'email:unread_count']);
  });
});

describe('email:new', () => {
  it('prepends using the ROW id, so the later refetch deduplicates', () => {
    mount();
    handlers.get('email:new')!(emailNew);

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
    handlers.get('email:new')!(emailNew);

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
    handlers.get('email:new')!(emailNew);
    expect(toast.info).toHaveBeenCalledWith('inbox.toast.newEmail:Alice');
  });

  it('stays quiet when the row is about to appear in front of them', () => {
    viewMode = { type: 'mailbox', mailbox: { _id: 'mb-1' } };
    mount();
    handlers.get('email:new')!(emailNew);
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('toasts in Search even though the last folder browsed is where the mail landed', () => {
    // `viewMode` keeps the folder while Search is on screen; the list is not.
    viewMode = { type: 'mailbox', mailbox: { _id: 'mb-1' } };
    pathname = '/search';
    mount();
    handlers.get('email:new')!(emailNew);
    expect(toast.info).toHaveBeenCalledWith('inbox.toast.newEmail:Alice');
  });

  it('toasts in Subscriptions too', () => {
    viewMode = { type: 'mailbox', mailbox: { _id: 'mb-1' } };
    pathname = '/subscriptions';
    mount();
    handlers.get('email:new')!(emailNew);
    expect(toast.info).toHaveBeenCalledTimes(1);
  });

  it('toasts while the settings modal covers the list', () => {
    viewMode = { type: 'mailbox', mailbox: { _id: 'mb-1' } };
    noteSettingsOpen(true);
    mount();
    handlers.get('email:new')!(emailNew);
    expect(toast.info).toHaveBeenCalledTimes(1);
  });

  it('does not toast a message whose push already showed the OS banner', () => {
    viewMode = { type: 'mailbox', mailbox: { _id: 'mb-OTHER' } };
    expect(claimNewMailAnnouncement(emailNew.id)).toBe(true); // the push got there first
    mount();
    handlers.get('email:new')!(emailNew);
    expect(toast.info).not.toHaveBeenCalled();
    // The cache is still updated: only the announcement is deduplicated.
    expect(setQueriesData).toHaveBeenCalled();
  });

  it('claims the message, so a push arriving after it stays quiet', () => {
    mount();
    handlers.get('email:new')!(emailNew);
    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(claimNewMailAnnouncement(emailNew.id)).toBe(false);
  });

  it('ignores a malformed payload instead of writing junk into the cache', () => {
    mount();
    handlers.get('email:new')!({ id: 'row-abc' });
    expect(setQueriesData).not.toHaveBeenCalled();
    expect(recordInboxMetric).toHaveBeenCalledWith('realtime_malformed_event');
  });

  it('ignores a payload that carries no id, even if it looks otherwise valid', () => {
    mount();
    const { id: _dropped, ...withoutId } = emailNew;
    handlers.get('email:new')!(withoutId);
    expect(setQueriesData).not.toHaveBeenCalled();
  });
});

describe('email:unread_count', () => {
  it('writes the server count over the optimistic one', () => {
    mount();
    handlers.get('email:unread_count')!({ mailboxId: 'mb-1', unread: 4 });

    const updater = setQueryData.mock.calls.at(-1)![1] as (old: unknown) => unknown;
    expect(updater([{ _id: 'mb-1', unseenMessages: 99 }])).toEqual([{ _id: 'mb-1', unseenMessages: 4 }]);
  });

  it('returns the same array when nothing changed, so nothing re-renders', () => {
    mount();
    handlers.get('email:unread_count')!({ mailboxId: 'mb-1', unread: 4 });

    const updater = setQueryData.mock.calls.at(-1)![1] as (old: unknown) => unknown;
    const unchanged = [{ _id: 'mb-1', unseenMessages: 4 }];
    expect(updater(unchanged)).toBe(unchanged);
  });

  it('ignores a malformed payload', () => {
    mount();
    handlers.get('email:unread_count')!({ mailboxId: 'mb-1' });
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
      handlers.get('email:changed')!({ id: `row-${i}`, mailboxIds: ['mb-drafts'], reason: 'deleted' });
    }
    expect(invalidateQueries).not.toHaveBeenCalled();
    jest.advanceTimersByTime(300);
    jest.useRealTimers();
    // One reconcile for the whole burst: six roots, once each.
    expect(invalidateQueries).toHaveBeenCalledTimes(6);
    const keys = invalidateQueries.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey[0]);
    expect(keys).toEqual(
      expect.arrayContaining(['messages', 'message', 'thread', 'search', 'bundles', 'mailboxes']),
    );
  });

  it('ignores a malformed payload', () => {
    mount();
    handlers.get('email:changed')!({ id: 'row-1', mailboxIds: 'not-an-array', reason: 'moved' });
    expect(invalidateQueries).not.toHaveBeenCalled();
    expect(recordInboxMetric).toHaveBeenCalledWith('realtime_malformed_event');
  });
});

describe('email:new into spam', () => {
  it('does not toast a sender whose mail was filed as spam', () => {
    cachedMailboxes = [{ _id: 'mb-junk', specialUse: '\\Junk' }];
    viewMode = null;
    mount();
    handlers.get('email:new')!({ ...emailNew, mailboxId: 'mb-junk', folder: 'spam' });
    expect(toast.info).not.toHaveBeenCalled();
    cachedMailboxes = [];
  });
});
