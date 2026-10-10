/**
 * Move off a conversation that is about to leave the list.
 *
 * Archive, Delete, Spam and Snooze take a conversation out of the list. If it
 * is the one selected, the selection moves to its neighbour — and on desktop
 * the reading pane goes with it. The mutations used to move the selection
 * themselves, without the pane: the list highlighted the next message while
 * the pane still showed the archived one, and the next `e` archived a message
 * the user had never seen.
 *
 * Call it BEFORE the action, while the list still holds the rows.
 */

import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { useCurrentList } from '@/hooks/useCurrentList';
import { useEmailStore } from '@/hooks/useEmail';
import { useIsDesktopLayout } from '@/hooks/useIsDesktopLayout';

export function useLeaveRemovedRows() {
  const router = useRouter();
  const isDesktop = useIsDesktopLayout();
  const { rows, conversationOf, viewHref } = useCurrentList();

  return useCallback(
    (removedIds: readonly string[]) => {
      const selected = useEmailStore.getState().selectedMessageId;
      if (!selected) return;
      const removed = new Set(removedIds);
      if (!removed.has(selected)) return;

      const holds = (rowId: string, ids: ReadonlySet<string>) =>
        ids.has(rowId) || conversationOf(rowId).some((m) => ids.has(m._id));
      const index = rows.findIndex((row) => holds(row._id, new Set([selected])));
      const stays = (i: number) => i >= 0 && i < rows.length && !holds(rows[i]._id, removed);
      let next = null;
      if (index !== -1) {
        for (let i = index + 1; i < rows.length && !next; i += 1) if (stays(i)) next = rows[i];
        for (let i = index - 1; i >= 0 && !next; i -= 1) if (stays(i)) next = rows[i];
      }

      useEmailStore.setState({ selectedMessageId: next?._id ?? null });
      if (!isDesktop) return;
      // A draft is selected but not opened: opening one means the composer.
      if (!next || next.flags.draft) router.replace(viewHref);
      else router.replace(`/conversation/${next._id}`);
    },
    [rows, conversationOf, viewHref, isDesktop, router],
  );
}
