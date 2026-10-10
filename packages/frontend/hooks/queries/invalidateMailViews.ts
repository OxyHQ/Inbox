import type { QueryClient } from '@tanstack/react-query';

import { emailKeys } from './queryKeys';

/**
 * Reconcile every query that shows mail after mail changed on the server.
 *
 * Mail is shown in more places than the mailbox lists: the open message, the
 * open conversation, search results, bundles, and the mailbox counts. Every
 * mutation and realtime event used to reconcile only the lists and the counts,
 * so a sent draft stayed in the search results, an archived message stayed in
 * its bundle, and a draft another device sent stayed open in the thread view.
 * One function, so the next view that shows mail is added in one place.
 *
 * `views: 'stale'` is for a mutation that has already patched the lists, the
 * open message and the thread optimistically (`utils/messageCache.ts`): those
 * are only marked stale, so an immediate refetch cannot race the optimistic
 * state. Search and bundles are never patched optimistically, so they are
 * always re-read when on screen.
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
  void queryClient.invalidateQueries({ queryKey: emailKeys.bundles });
  void queryClient.invalidateQueries({ queryKey: emailKeys.mailboxes.root });
}
