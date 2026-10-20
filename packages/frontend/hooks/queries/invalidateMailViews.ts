import type { QueryClient } from '@tanstack/react-query';

import type { ThreadData } from '@/services/emailApi';
import { emailKeys } from './queryKeys';

/**
 * Reconcile every query that shows mail after mail changed on the server.
 *
 * Mail is shown in more places than the mailbox lists: the open message, the
 * open conversation, search results, and the mailbox counts. Every mutation
 * and realtime event used to reconcile only the lists and the counts, so a
 * sent draft stayed in the search results and a draft another device sent
 * stayed open in the thread view. One function, so the next view that shows
 * mail is added in one place.
 *
 * `['bundles']` is not among them: it is the bundle CONFIGURATION (names and
 * labels), which no change to mail touches. The bundles on screen are built
 * from the message lists. Only the bundle mutations re-read it.
 *
 * `views: 'stale'` is for a mutation that has already patched the lists, the
 * open message and the thread optimistically (`utils/messageCache.ts`): those
 * are only marked stale, so an immediate refetch cannot race the optimistic
 * state. Search is never patched optimistically, so it is always re-read when
 * on screen.
 */
export function invalidateMailViews(
  queryClient: QueryClient,
  { views = 'refetch' }: { views?: 'refetch' | 'stale' } = {},
): void {
  const refetchType = views === 'stale' ? 'none' : 'active';
  void queryClient.invalidateQueries({ queryKey: emailKeys.messages.root, refetchType });
  void queryClient.invalidateQueries({ queryKey: emailKeys.message.root, refetchType });
  void queryClient.invalidateQueries({ queryKey: emailKeys.thread.root, refetchType });
  void queryClient.invalidateQueries({ queryKey: emailKeys.searchRoot });
  void queryClient.invalidateQueries({ queryKey: emailKeys.mailboxes.root });
}

/**
 * Reconcile after messages changed somewhere else (`email:changed`), by what
 * changed.
 *
 * A flag, a label or a delivery state changes how a message reads, not where
 * it is: the message, the conversations that hold it and the lists are
 * re-read, and its folder's unread count arrives as an event of its own
 * (`email:unread_count`). Search is only marked stale. A move, a delete or a
 * send changes folders as well, so everything is re-read (`invalidateMailViews`).
 */
export function invalidateChangedMail(
  queryClient: QueryClient,
  messageIds: ReadonlySet<string>,
  { folders }: { folders: boolean },
): void {
  if (folders) {
    invalidateMailViews(queryClient);
    return;
  }
  void queryClient.invalidateQueries({ queryKey: emailKeys.messages.root });
  for (const id of messageIds) {
    void queryClient.invalidateQueries({ queryKey: emailKeys.message.byId(id) });
  }
  void queryClient.invalidateQueries({
    queryKey: emailKeys.thread.root,
    predicate: (query) =>
      messageIds.has(query.queryKey[1] as string) ||
      ((query.state.data as ThreadData | undefined)?.messages.some((m) => messageIds.has(m._id)) ??
        false),
  });
  void queryClient.invalidateQueries({ queryKey: emailKeys.searchRoot, refetchType: 'none' });
}
