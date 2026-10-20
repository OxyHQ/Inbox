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
  type MoveKind,
} from '@/hooks/mutations/useMessageMutations';

export function useMessageActions() {
  const { t } = useTranslation();
  const { data: mailboxes = [] } = useMailboxes();

  // Each mutation's `mutate`, which is stable across renders — unlike the
  // mutation objects, which change with every state change of any of them.
  // Depending on those made every action, and the object returned here, new
  // on each pending/settled transition, and every memoized row re-rendered.
  const { mutate: toggleRead } = useToggleRead();
  const { mutate: toggleStar } = useToggleStar();
  const { mutate: togglePin } = useTogglePin();
  const { mutate: archiveMessage } = useArchiveMessage();
  const { mutate: deleteMessage } = useDeleteMessage();
  const { mutate: snoozeMessages } = useSnoozeMessage();
  const { mutate: unsnoozeMessage } = useUnsnoozeMessage();
  const { mutate: bulkFlags } = useBulkUpdateFlags();
  const { mutate: bulkMove } = useBulkMoveMessages();
  const { mutate: bulkDelete } = useBulkDeleteMessages();

  /**
   * Mark a conversation read or unread. Only the messages whose state changes
   * are sent; `quiet` is for marking read on open, which needs no toast.
   */
  const setRead = useCallback(
    (conversation: Message[], seen: boolean, { quiet = false }: { quiet?: boolean } = {}) => {
      const changed = conversation.filter((m) => m.flags.seen !== seen && !m.flags.draft);
      if (changed.length === 0) return;
      if (changed.length === 1) {
        toggleRead({ messageId: changed[0]._id, seen });
        return;
      }
      bulkFlags({ messageIds: changed.map((m) => m._id), flags: { seen }, quiet });
    },
    [toggleRead, bulkFlags],
  );

  /** Set the split-view selection before navigation. Reading marks read (MessageDetail). */
  const prepareOpenMessage = useCallback((messageId: string) => {
    useEmailStore.setState({ selectedMessageId: messageId });
  }, []);

  const star = useCallback(
    (messageId: string, starred: boolean) => toggleStar({ messageId, starred }),
    [toggleStar],
  );

  const pin = useCallback(
    (messageId: string, pinned: boolean) => togglePin({ messageId, pinned }),
    [togglePin],
  );

  const moveTo = useCallback(
    (conversation: Message[], mailboxId: string, kind: MoveKind = 'move') => {
      if (conversation.length === 0) return;
      if (conversation.length === 1) {
        archiveMessage({ messageId: conversation[0]._id, archiveMailboxId: mailboxId, kind });
        return;
      }
      bulkMove({ messageIds: conversation.map((m) => m._id), mailboxId, kind });
    },
    [archiveMessage, bulkMove],
  );

  const archiveBox = useMemo(
    () => mailboxes.find((m) => m.specialUse === SPECIAL_USE.ARCHIVE),
    [mailboxes],
  );

  /** Already archived: every message of it is in Archive. */
  const isArchived = useCallback(
    (conversation: Message[]) =>
      !!archiveBox &&
      conversation.length > 0 &&
      conversation.every((m) => m.mailboxId === archiveBox._id),
    [archiveBox],
  );

  /**
   * Archive — or, for a conversation already in Archive, move it back to the
   * Inbox. Archived mail had no way back: in Archive the same button archived
   * again, which does nothing.
   */
  const archive = useCallback(
    (conversation: Message[]) => {
      if (isArchived(conversation)) {
        const inbox = mailboxes.find((m) => m.specialUse === SPECIAL_USE.INBOX);
        if (inbox) moveTo(conversation, inbox._id, 'inbox');
        return;
      }
      if (!archiveBox) {
        toast.error(t('inbox.toast.archiveUnavailable'));
        return;
      }
      moveTo(conversation, archiveBox._id, 'archive');
    },
    [archiveBox, isArchived, mailboxes, moveTo, t],
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
        deleteMessage({
          messageId: conversation[0]._id,
          trashMailboxId: trashBox?._id,
          isInTrash: inTrash(conversation[0]),
        });
        return;
      }
      bulkDelete({
        toTrash: conversation.filter((m) => !inTrash(m)).map((m) => m._id),
        permanent: conversation.filter(inTrash).map((m) => m._id),
        trashMailboxId: trashBox?._id,
      });
    },
    [mailboxes, deleteMessage, bulkDelete],
  );

  const snooze = useCallback(
    (conversation: Message[], until: string) => {
      if (conversation.length === 0) return;
      snoozeMessages({ messageIds: conversation.map((m) => m._id), until });
    },
    [snoozeMessages],
  );

  const unsnooze = useCallback(
    (messageId: string) => unsnoozeMessage({ messageId }),
    [unsnoozeMessage],
  );

  return useMemo(
    () => ({
      setRead,
      prepareOpenMessage,
      star,
      pin,
      moveTo,
      archive,
      isArchived,
      deleteConversation,
      snooze,
      unsnooze,
    }),
    [
      setRead,
      prepareOpenMessage,
      star,
      pin,
      moveTo,
      archive,
      isArchived,
      deleteConversation,
      snooze,
      unsnooze,
    ],
  );
}
