/**
 * Thin action facade over the message mutation hooks.
 *
 * Components (InboxList, MessageDetail, SwipeableRow) call these named actions
 * instead of wiring up individual mutations and resolving mailbox ids inline.
 * All cache logic lives in `utils/messageCache.ts` and the mutation hooks; this
 * layer only orchestrates.
 *
 * Actions take a CONVERSATION — every message it holds in the list or folder
 * acted on (see `groupThreads`). A row in conversation view stands for all of
 * them, and acting on the row's own message alone left the rest behind: the
 * row came straight back after Archive, and a row shown unread because of an
 * older message could not be marked read.
 */

import { useCallback, useMemo } from 'react';
import { toast } from '@oxy.so/bloom';
import { useEmailStore } from '@/hooks/useEmail';
import { useMailboxes } from '@/hooks/queries/useMailboxes';
import { SPECIAL_USE } from '@/constants/mailbox';
import { useTranslation } from '@/lib/i18n';
import type { Message } from '@/services/emailApi';
import {
  useArchiveMessage,
  useBulkDeleteMessages,
  useBulkMoveMessages,
  useBulkUpdateFlags,
  useDeleteMessage,
  useSnoozeMessage,
  useTogglePin,
  useToggleRead,
  useToggleStar,
  useUnsnoozeMessage,
} from '@/hooks/mutations/useMessageMutations';

export function useMessageActions() {
  const { t } = useTranslation();
  const { data: mailboxes = [] } = useMailboxes();

  const toggleRead = useToggleRead();
  const toggleStar = useToggleStar();
  const togglePin = useTogglePin();
  const archiveMutation = useArchiveMessage();
  const deleteMutation = useDeleteMessage();
  const snoozeMutation = useSnoozeMessage();
  const unsnoozeMutation = useUnsnoozeMessage();
  const bulkFlags = useBulkUpdateFlags();
  const bulkMove = useBulkMoveMessages();
  const bulkDelete = useBulkDeleteMessages();

  /**
   * Mark a conversation read or unread. Only the messages whose state changes
   * are sent; `quiet` is for marking read on open, which needs no toast.
   */
  const setRead = useCallback(
    (conversation: Message[], seen: boolean, { quiet = false }: { quiet?: boolean } = {}) => {
      const changed = conversation.filter((m) => m.flags.seen !== seen && !m.flags.draft);
      if (changed.length === 0) return;
      if (changed.length === 1) {
        toggleRead.mutate({ messageId: changed[0]._id, seen });
        return;
      }
      bulkFlags.mutate({ messageIds: changed.map((m) => m._id), flags: { seen }, quiet });
    },
    [toggleRead, bulkFlags],
  );

  /** Set the split-view selection before navigation. Reading marks read (MessageDetail). */
  const prepareOpenMessage = useCallback((messageId: string) => {
    useEmailStore.setState({ selectedMessageId: messageId });
  }, []);

  const star = useCallback(
    (messageId: string, starred: boolean) => toggleStar.mutate({ messageId, starred }),
    [toggleStar],
  );

  const pin = useCallback(
    (messageId: string, pinned: boolean) => togglePin.mutate({ messageId, pinned }),
    [togglePin],
  );

  const moveTo = useCallback(
    (conversation: Message[], mailboxId: string) => {
      if (conversation.length === 0) return;
      if (conversation.length === 1) {
        archiveMutation.mutate({ messageId: conversation[0]._id, archiveMailboxId: mailboxId });
        return;
      }
      bulkMove.mutate({ messageIds: conversation.map((m) => m._id), mailboxId });
    },
    [archiveMutation, bulkMove],
  );

  const archive = useCallback(
    (conversation: Message[]) => {
      const archiveBox = mailboxes.find((m) => m.specialUse === SPECIAL_USE.ARCHIVE);
      if (!archiveBox) {
        toast.error(t('inbox.toast.archiveUnavailable'));
        return;
      }
      moveTo(conversation, archiveBox._id);
    },
    [mailboxes, moveTo, t],
  );

  /**
   * To Trash; a message already in Trash is deleted for good. Decided per
   * message from where it IS, never from the folder last browsed.
   */
  const deleteConversation = useCallback(
    (conversation: Message[]) => {
      if (conversation.length === 0) return;
      const trashBox = mailboxes.find((m) => m.specialUse === SPECIAL_USE.TRASH);
      const inTrash = (m: Message) => !!trashBox && m.mailboxId === trashBox._id;
      if (conversation.length === 1) {
        deleteMutation.mutate({
          messageId: conversation[0]._id,
          trashMailboxId: trashBox?._id,
          isInTrash: inTrash(conversation[0]),
        });
        return;
      }
      bulkDelete.mutate({
        toTrash: conversation.filter((m) => !inTrash(m)).map((m) => m._id),
        permanent: conversation.filter(inTrash).map((m) => m._id),
        trashMailboxId: trashBox?._id,
      });
    },
    [mailboxes, deleteMutation, bulkDelete],
  );

  const snooze = useCallback(
    (conversation: Message[], until: string) => {
      if (conversation.length === 0) return;
      snoozeMutation.mutate({ messageIds: conversation.map((m) => m._id), until });
    },
    [snoozeMutation],
  );

  const unsnooze = useCallback(
    (messageId: string) => unsnoozeMutation.mutate({ messageId }),
    [unsnoozeMutation],
  );

  return useMemo(
    () => ({
      setRead,
      prepareOpenMessage,
      star,
      pin,
      moveTo,
      archive,
      deleteConversation,
      snooze,
      unsnooze,
      // Expose underlying mutations for pending/variables introspection.
      mutations: {
        toggleRead,
        toggleStar,
        togglePin,
        archiveMutation,
        deleteMutation,
        snoozeMutation,
        unsnoozeMutation,
        bulkFlags,
        bulkMove,
        bulkDelete,
      },
    }),
    [
      setRead,
      prepareOpenMessage,
      star,
      pin,
      moveTo,
      archive,
      deleteConversation,
      snooze,
      unsnooze,
      toggleRead,
      toggleStar,
      togglePin,
      archiveMutation,
      deleteMutation,
      snoozeMutation,
      unsnoozeMutation,
      bulkFlags,
      bulkMove,
      bulkDelete,
    ],
  );
}
