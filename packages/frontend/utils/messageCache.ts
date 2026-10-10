/**
 * Centralized React Query cache helpers for the Inbox message caches.
 *
 * Single source of truth for how the three message-related caches are read and
 * mutated:
 *   - `['messages', ...]`         infinite list (per mailbox/view)
 *   - `['message', id, userId]`   single message detail
 *   - `['thread', ...]`           thread view
 *   - `['mailboxes', userId]`     mailbox list (unseen counts)
 *
 * Mutation hooks call these helpers instead of inlining `setQueriesData`
 * logic, so there is exactly one place that understands the cache shapes.
 */

import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';
import { emailKeys } from '@/hooks/queries/queryKeys';
import { invalidateMailViews } from '@/hooks/queries/invalidateMailViews';
import type { Mailbox, Message, Pagination, ThreadData, UnreadableMessage } from '@/services/emailApi';

/** One page of a `['messages', ...]` infinite list. */
export interface MessagesPage {
  data: Message[];
  /** Rows the API sent that failed the schema; rendered as degraded rows. */
  unreadable?: UnreadableMessage[];
  pagination: Pagination;
}

export type MessagesInfinite = InfiniteData<MessagesPage>;

// ─── Low-level page helpers ──────────────────────────────────────────

/** Update a single message across every page of an infinite list. */
export function updateMessageInPages(
  old: MessagesInfinite | undefined,
  messageId: string,
  updater: (msg: Message) => Message,
): MessagesInfinite | undefined {
  if (!old) return old;
  return {
    ...old,
    pages: old.pages.map((page) => ({
      ...page,
      data: page.data.map((m) => (m._id === messageId ? updater(m) : m)),
    })),
  };
}

/** Remove a single message from every page of an infinite list. */
export function removeMessageFromPages(
  old: MessagesInfinite | undefined,
  messageId: string,
): MessagesInfinite | undefined {
  if (!old) return old;
  return {
    ...old,
    pages: old.pages.map((page) => ({
      ...page,
      data: page.data.filter((m) => m._id !== messageId),
    })),
  };
}

/** Update one message of a cached thread; its unreadable rows are untouched. */
export function updateThreadMessage(
  old: ThreadData | undefined,
  messageId: string,
  updater: (msg: Message) => Message,
): ThreadData | undefined {
  if (!old) return old;
  return { ...old, messages: old.messages.map((m) => (m._id === messageId ? updater(m) : m)) };
}

/** Flatten all messages from an infinite query into a single array. */
export function flatMessages(data: MessagesInfinite | undefined): Message[] {
  if (!data) return [];
  return data.pages.flatMap((p) => p.data);
}

/**
 * Merge a server flag-update response into an existing cached message without
 * dropping detail-only fields (body, headers) that the flag/label update
 * endpoints intentionally omit from their responses.
 */
export function mergeMessageUpdate(old: Message | null | undefined, updated: Message): Message {
  if (!old) return updated;
  return {
    ...old,
    ...updated,
    text: updated.text ?? old.text,
    html: updated.html ?? old.html,
    headers: updated.headers ?? old.headers,
    flags: { ...old.flags, ...updated.flags },
  };
}

// ─── Lookups ─────────────────────────────────────────────────────────

/** Find a cached message by id, checking the list caches then the detail cache. */
export function findCachedMessage(
  queryClient: QueryClient,
  messageId: string,
  userId: string | null,
): Message | undefined {
  for (const [, data] of queryClient.getQueriesData<MessagesInfinite>({ queryKey: emailKeys.messages.root })) {
    const found = flatMessages(data).find((m) => m._id === messageId);
    if (found) return found;
  }
  return queryClient.getQueryData<Message | null>(emailKeys.message.detail(messageId, userId)) ?? undefined;
}

// ─── Optimistic patches ──────────────────────────────────────────────

/**
 * Patch a message's flags across all three caches (list, detail, thread).
 * Only the provided flag keys are touched; other flags are preserved.
 */
export function patchMessageFlags(
  queryClient: QueryClient,
  messageId: string,
  userId: string | null,
  flags: Partial<Message['flags']>,
): void {
  queryClient.setQueriesData<MessagesInfinite>({ queryKey: emailKeys.messages.root }, (old) =>
    updateMessageInPages(old, messageId, (m) => ({ ...m, flags: { ...m.flags, ...flags } })),
  );
  queryClient.setQueryData<Message | null>(emailKeys.message.detail(messageId, userId), (old) =>
    old ? { ...old, flags: { ...old.flags, ...flags } } : old,
  );
  queryClient.setQueriesData<ThreadData>({ queryKey: emailKeys.thread.root }, (old) =>
    updateThreadMessage(old, messageId, (m) => ({ ...m, flags: { ...m.flags, ...flags } })),
  );
}

/** Apply an arbitrary updater to a message across every list cache. */
export function patchMessageInList(
  queryClient: QueryClient,
  messageId: string,
  updater: (msg: Message) => Message,
): void {
  queryClient.setQueriesData<MessagesInfinite>({ queryKey: emailKeys.messages.root }, (old) =>
    updateMessageInPages(old, messageId, updater),
  );
}

/** Remove a message from every list cache (archive, delete, snooze). */
export function removeMessageFromList(queryClient: QueryClient, messageId: string): void {
  queryClient.setQueriesData<MessagesInfinite>({ queryKey: emailKeys.messages.root }, (old) =>
    removeMessageFromPages(old, messageId),
  );
}

/**
 * Adjust the unseen-message count of a mailbox in the `['mailboxes']` cache.
 * Clamped at zero. Used to keep sidebar badges instant on read/unread toggles.
 */
export function patchMailboxUnseen(
  queryClient: QueryClient,
  mailboxId: string | null | undefined,
  delta: number,
): void {
  if (!mailboxId || delta === 0) return;
  queryClient.setQueriesData<Mailbox[]>({ queryKey: emailKeys.mailboxes.root }, (old) =>
    old?.map((mb) =>
      mb._id === mailboxId
        ? { ...mb, unseenMessages: Math.max(0, mb.unseenMessages + delta) }
        : mb,
    ),
  );
}

/**
 * Merge a server message response into all caches after a successful mutation,
 * without dropping detail-only fields the update endpoint omits.
 */
export function mergeServerMessage(
  queryClient: QueryClient,
  messageId: string,
  userId: string | null,
  updated: Message,
  options: { skipList?: boolean } = {},
): void {
  queryClient.setQueryData<Message | null>(emailKeys.message.detail(messageId, userId), (old) =>
    mergeMessageUpdate(old, updated),
  );
  if (!options.skipList) {
    queryClient.setQueriesData<MessagesInfinite>({ queryKey: emailKeys.messages.root }, (old) =>
      updateMessageInPages(old, messageId, (message) => mergeMessageUpdate(message, updated)),
    );
  }
  queryClient.setQueriesData<ThreadData>({ queryKey: emailKeys.thread.root }, (old) =>
    updateThreadMessage(old, messageId, (m) => mergeMessageUpdate(m, updated)),
  );
}

// ─── Snapshot / rollback ─────────────────────────────────────────────

export interface MessageSnapshot {
  messageIds: string[];
  userId: string | null;
  prevMessages: [QueryKey, MessagesInfinite | undefined][];
  prevDetails: [string, Message | null | undefined][];
  prevThreads: [QueryKey, ThreadData | undefined][];
}

/**
 * Capture the messages a mutation is about to change, so a failure can put
 * them back with `restoreSnapshot`.
 */
export function snapshotForRollback(
  queryClient: QueryClient,
  messageIds: string | readonly string[],
  userId: string | null,
): MessageSnapshot {
  const ids = typeof messageIds === 'string' ? [messageIds] : [...messageIds];
  return {
    messageIds: ids,
    userId,
    prevMessages: queryClient.getQueriesData<MessagesInfinite>({ queryKey: emailKeys.messages.root }),
    prevDetails: ids.map((id) => [id, queryClient.getQueryData<Message | null>(emailKeys.message.detail(id, userId))]),
    prevThreads: queryClient.getQueriesData<ThreadData>({ queryKey: emailKeys.thread.root }),
  };
}

/**
 * `current` with the snapshot's messages put back as they were in `prev`: a
 * changed one replaced by its old version, a removed one re-inserted after the
 * row it followed, one that was not there before taken out again. Everything
 * else is left as it is NOW.
 */
function restoreRows(current: Message[][], prev: Message[], ids: ReadonlySet<string>): Message[][] {
  const before = new Map(prev.filter((m) => ids.has(m._id)).map((m) => [m._id, m]));
  const pages = current.map((rows) =>
    rows.filter((m) => !ids.has(m._id) || before.has(m._id)).map((m) => before.get(m._id) ?? m),
  );
  const present = new Set(pages.flat().map((m) => m._id));
  prev.forEach((message, index) => {
    if (!ids.has(message._id) || present.has(message._id)) return;
    let anchor: string | null = null;
    for (let i = index - 1; i >= 0; i -= 1) {
      if (present.has(prev[i]._id)) {
        anchor = prev[i]._id;
        break;
      }
    }
    if (anchor === null) {
      if (pages.length > 0) pages[0].unshift(message);
    } else {
      for (const rows of pages) {
        const at = rows.findIndex((m) => m._id === anchor);
        if (at !== -1) {
          rows.splice(at + 1, 0, message);
          break;
        }
      }
    }
    present.add(message._id);
  });
  return pages;
}

/**
 * Undo a failed mutation's optimistic changes — for ITS messages only.
 *
 * Restoring whole cached lists, as this used to, also undid every change made
 * since the snapshot: archive A then B, A fails, and B came back although its
 * archive had succeeded. Then the views are re-read, because the server is the
 * one that knows what the failure left behind.
 */
export function restoreSnapshot(
  queryClient: QueryClient,
  snapshot: MessageSnapshot,
  { reread = true }: { reread?: boolean } = {},
): void {
  const ids = new Set(snapshot.messageIds);
  for (const [key, prev] of snapshot.prevMessages) {
    if (!prev) continue;
    queryClient.setQueryData<MessagesInfinite>(key, (current) => {
      if (!current) return current;
      const pages = restoreRows(
        current.pages.map((page) => page.data),
        flatMessages(prev),
        ids,
      );
      return { ...current, pages: current.pages.map((page, i) => ({ ...page, data: pages[i] })) };
    });
  }
  for (const [key, prev] of snapshot.prevThreads) {
    if (!prev) continue;
    queryClient.setQueryData<ThreadData>(key, (current) =>
      current ? { ...current, messages: restoreRows([current.messages], prev.messages, ids)[0] } : current,
    );
  }
  for (const [id, prev] of snapshot.prevDetails) {
    queryClient.setQueryData(emailKeys.message.detail(id, snapshot.userId), prev);
  }
  // Counts are not restored by hand: other changes moved them too.
  if (reread) invalidateMailViews(queryClient);
}

/**
 * Where each of the snapshot's messages was — its folder before the mutation —
 * as far as any cache knew it. What an Undo moves them back to.
 */
export function snapshotOrigins(snapshot: MessageSnapshot): Map<string, string> {
  const ids = new Set(snapshot.messageIds);
  const origins = new Map<string, string>();
  const note = (message: Message | null | undefined) => {
    if (message && ids.has(message._id) && message.mailboxId && !origins.has(message._id)) {
      origins.set(message._id, message.mailboxId);
    }
  };
  for (const [, prev] of snapshot.prevDetails) note(prev);
  for (const [, data] of snapshot.prevMessages) flatMessages(data).forEach(note);
  for (const [, data] of snapshot.prevThreads) data?.messages.forEach(note);
  return origins;
}

/** Cancel in-flight queries for the message caches before an optimistic update. */
export async function cancelMessageQueries(
  queryClient: QueryClient,
  messageId?: string,
): Promise<void> {
  await Promise.all([
    queryClient.cancelQueries({ queryKey: emailKeys.messages.root }),
    messageId
      ? queryClient.cancelQueries({ queryKey: emailKeys.message.byId(messageId) })
      : Promise.resolve(),
    queryClient.cancelQueries({ queryKey: emailKeys.thread.root }),
  ]);
}
