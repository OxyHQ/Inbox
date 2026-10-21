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
const invalidateQueries = jest.fn((_filters: unknown) => Promise.resolve());
let cachedMailboxes: unknown[] = [];
const getQueryData = jest.fn(() => cachedMailboxes);
let cachedLists: [unknown, unknown][] = [];
const getQueriesData = jest.fn(() => cachedLists);
const fetchQuery = jest.fn(
  ({ queryFn }: { queryFn: (context: { signal?: AbortSignal }) => unknown }) => queryFn({}),
);
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: () => ({
    setQueriesData,
    setQueryData,
    invalidateQueries,
    getQueryData,
    getQueriesData,
    fetchQuery,
  }),
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
import { __resetOwnChanges, isOwnChange, noteOwnChange } from '@/utils/ownChanges';

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
  cachedLists = [];
  __resetNewMailAttention();
  __resetOwnChanges();
});

/** Which roots were invalidated, and how. */
function invalidated() {
  return invalidateQueries.mock.calls.map(([filters]) => {
    const f = filters as { queryKey?: unknown[]; refetchType?: string; predicate?: unknown };
    return { key: f.queryKey ?? [], refetchType: f.refetchType, targeted: Boolean(f.predicate) };
  });
}

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

  it('bumps the unread badge once for an event delivered twice', () => {
    mount();
    emit('email:new', emailNew);
    emit('email:new', emailNew);

    const badgeWrites = setQueryData.mock.calls.filter(
      ([key]) => (key as unknown[])[0] === 'mailboxes',
    );
    expect(badgeWrites).toHaveLength(1);
    const update = badgeWrites[0][1] as (old: unknown) => unknown;
    expect(update([{ _id: 'mb-1', unseenMessages: 2, totalMessages: 10 }])).toEqual([
      { _id: 'mb-1', unseenMessages: 3, totalMessages: 11 },
    ]);
  });

  it('re-reads the conversation the new mail joined, not every one, and leaves searches stale', async () => {
    cachedLists = [
      [
        ['messages', 'mb-1', false, null, 'user-1'],
        { pages: [{ data: [{ _id: 'row-abc', threadId: 'row-root' }] }] },
      ],
    ];
    mount();
    emit('email:new', emailNew);
    await Promise.resolve();
    await Promise.resolve();

    const calls = invalidated();
    expect(calls).toContainEqual({ key: ['search'], refetchType: 'none', targeted: false });
    expect(calls).toContainEqual({ key: ['thread'], refetchType: undefined, targeted: true });
    expect(calls.map((call) => call.key[0])).not.toContain('bundles');
    const threads = invalidateQueries.mock.calls
      .map(([filters]) => filters as { queryKey?: unknown[]; predicate?: (q: unknown) => boolean })
      .find((filters) => filters.queryKey?.[0] === 'thread');
    const holding = (threadId: string) => ({
      queryKey: ['thread', 'x'],
      state: { data: { messages: [{ _id: 'x', threadId }], unreadable: [] } },
    });
    expect(threads?.predicate?.(holding('row-root'))).toBe(true);
    expect(threads?.predicate?.(holding('other'))).toBe(false);
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
    // One reconcile for the whole burst: five roots, once each — and never
    // the bundle configuration, which no change to mail touches.
    expect(invalidateQueries).toHaveBeenCalledTimes(5);
    const keys = invalidated().map((call) => call.key[0]);
    expect(keys).toEqual(
      expect.arrayContaining(['messages', 'message', 'thread', 'search', 'mailboxes']),
    );
    expect(keys).not.toContain('bundles');
  });

  it('skips the echo of a change this client made itself', () => {
    jest.useFakeTimers();
    mount();
    noteOwnChange(['row-1', 'row-2']);
    emit('email:changed', { id: 'row-1', mailboxIds: ['mb-1'], reason: 'moved' });
    emit('email:changed', { id: 'row-2', mailboxIds: ['mb-1'], reason: 'flags' });
    jest.advanceTimersByTime(300);
    jest.useRealTimers();

    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it('still reconciles a change of its own messages that came from elsewhere', () => {
    jest.useFakeTimers();
    mount();
    noteOwnChange(['row-1']);
    emit('email:changed', { id: 'row-1', mailboxIds: ['mb-1'], reason: 'moved' });
    emit('email:changed', { id: 'row-3', mailboxIds: ['mb-1'], reason: 'moved' });
    jest.advanceTimersByTime(300);
    jest.useRealTimers();

    expect(invalidated().map((call) => call.key[0])).toContain('mailboxes');
  });

  it('re-reads only the message, its conversation and the lists for a flag change', () => {
    jest.useFakeTimers();
    mount();
    emit('email:changed', { id: 'row-1', mailboxIds: ['mb-1'], reason: 'flags' });
    jest.advanceTimersByTime(300);
    jest.useRealTimers();

    const calls = invalidated();
    expect(calls).toEqual(
      expect.arrayContaining([
        { key: ['messages'], refetchType: undefined, targeted: false },
        { key: ['message', 'row-1'], refetchType: undefined, targeted: false },
        { key: ['thread'], refetchType: undefined, targeted: true },
        { key: ['search'], refetchType: 'none', targeted: false },
      ]),
    );
    // Its folder's count arrives as `email:unread_count`; nothing else moved.
    expect(calls.map((call) => call.key[0])).not.toContain('mailboxes');
    expect(calls).toHaveLength(4);
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
  // After the coalescing window, when the burst is reconciled.
  const flush = () => new Promise((resolve) => setTimeout(resolve, 350));

  it('re-reads the message, and is quiet when it went out', async () => {
    getMessage.mockResolvedValue({
      _id: 'row-sent',
      subject: 'Re: Quota',
      delivery: { state: 'sent' },
    });
    mount();
    emit('email:changed', changed);
    await flush();

    expect(getMessage).toHaveBeenCalledWith('row-sent', expect.anything());
    // Through the message's own query, so an open message is read once.
    expect(fetchQuery).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['message', 'row-sent', 'user-1'] }),
    );
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

describe('own changes', () => {
  it("are forgotten after a while: a later event is someone else's change", () => {
    noteOwnChange(['row-1'], 1_000);
    expect(isOwnChange('row-1', 2_000)).toBe(true);
    expect(isOwnChange('row-1', 1_000 + 16_000)).toBe(false);
    expect(isOwnChange('row-2', 2_000)).toBe(false);
  });
});
