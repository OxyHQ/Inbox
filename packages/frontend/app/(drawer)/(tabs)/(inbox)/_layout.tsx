import { useIsDesktopLayout } from '@/hooks/useIsDesktopLayout';
/** A stable route stack preserves drafts and list state when the shell changes width. */

import { useDialogControl } from '@oxy.so/bloom';
import { useOxy } from '@oxy.so/services';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';

import { KeyboardShortcutsHelp } from '@/components/KeyboardShortcutsHelp';
import { SPECIAL_USE } from '@/constants/mailbox';
import {
  useArchiveMessage,
  useDeleteMessage,
  useToggleRead,
  useToggleStar,
} from '@/hooks/mutations/useMessageMutations';
import { useMailboxes } from '@/hooks/queries/useMailboxes';
import { useMessages } from '@/hooks/queries/useMessages';
import { useEmailStore } from '@/hooks/useEmail';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import {
  buildReplyRecipients,
  joinAddresses,
  type ReplyMode,
} from '@/utils/replyRecipients';
import { messageRoute } from '@/utils/messageRoute';

export default function InboxLayout() {
  const router = useRouter();
  const { user } = useOxy();
  const isDesktop = useIsDesktopLayout();
  const currentMailbox = useEmailStore((s) => s.currentMailbox);
  const selectedMessageId = useEmailStore((s) => s.selectedMessageId);

  const { data: mailboxes = [] } = useMailboxes();
  const inboxMailboxId = useMemo(
    () => mailboxes.find((m) => m.specialUse === SPECIAL_USE.INBOX)?._id,
    [mailboxes],
  );
  const { data: messagesData } = useMessages({
    mailboxId: currentMailbox?._id ?? inboxMailboxId,
  });
  const messages = useMemo(
    () => messagesData?.pages.flatMap((p) => p.data) ?? [],
    [messagesData],
  );

  const toggleStar = useToggleStar();
  const toggleRead = useToggleRead();
  const archiveMutation = useArchiveMessage();
  const deleteMutation = useDeleteMessage();

  const currentIndex = useMemo(() => {
    if (!selectedMessageId) return -1;
    return messages.findIndex((m) => m._id === selectedMessageId);
  }, [selectedMessageId, messages]);

  const currentMessage = useMemo(() => {
    if (currentIndex === -1) return null;
    return messages[currentIndex] ?? null;
  }, [currentIndex, messages]);

  const handleCompose = useCallback(() => {
    router.push('/compose');
  }, [router]);

  const openReply = useCallback(
    (mode: ReplyMode) => {
      if (!selectedMessageId || !currentMessage || !isDesktop) return;
      // Replying to your own unsent draft is not a reply: finish the draft.
      if (currentMessage.flags.draft) {
        router.push(messageRoute(currentMessage));
        return;
      }
      const { to, cc } = buildReplyRecipients(currentMessage, mode, {
        username: user?.username,
        email: user?.email,
      });
      router.push({
        pathname: '/compose',
        params: {
          // The parent's ROW id — the composer loads the parent by it to build
          // the RFC threading headers. It is never sent as `In-Reply-To`.
          replyTo: currentMessage._id,
          to: joinAddresses(to),
          ...(cc.length > 0 ? { cc: joinAddresses(cc) } : {}),
          subject: currentMessage.subject.startsWith('Re:')
            ? currentMessage.subject
            : `Re: ${currentMessage.subject}`,
        },
      });
    },
    [
      selectedMessageId,
      currentMessage,
      router,
      isDesktop,
      user?.username,
      user?.email,
    ],
  );

  const handleReply = useCallback(() => openReply('reply'), [openReply]);
  const handleReplyAll = useCallback(() => openReply('reply-all'), [openReply]);

  const handleForward = useCallback(() => {
    if (selectedMessageId && currentMessage) {
      if (isDesktop) {
        if (currentMessage.flags.draft) {
          router.push(messageRoute(currentMessage));
          return;
        }
        router.push({
          pathname: '/compose',
          params: {
            forward: currentMessage._id,
            subject: currentMessage.subject.startsWith('Fwd:')
              ? currentMessage.subject
              : `Fwd: ${currentMessage.subject}`,
          },
        });
      }
    }
  }, [selectedMessageId, currentMessage, router, isDesktop]);

  const handleArchive = useCallback(() => {
    if (selectedMessageId) {
      const archiveBox = mailboxes.find(
        (m) => m.specialUse === SPECIAL_USE.ARCHIVE,
      );
      if (archiveBox) {
        archiveMutation.mutate({
          messageId: selectedMessageId,
          archiveMailboxId: archiveBox._id,
        });
      }
    }
  }, [selectedMessageId, mailboxes, archiveMutation]);

  const handleDelete = useCallback(() => {
    if (selectedMessageId) {
      const trashBox = mailboxes.find(
        (m) => m.specialUse === SPECIAL_USE.TRASH,
      );
      const isInTrash = currentMailbox?.specialUse === SPECIAL_USE.TRASH;
      deleteMutation.mutate({
        messageId: selectedMessageId,
        trashMailboxId: trashBox?._id,
        isInTrash,
      });
    }
  }, [selectedMessageId, mailboxes, currentMailbox, deleteMutation]);

  const handleNextMessage = useCallback(() => {
    if (currentIndex < messages.length - 1) {
      const nextMessage = messages[currentIndex + 1];
      useEmailStore.setState({ selectedMessageId: nextMessage._id });
      // A draft is selected but not opened: opening it means the composer,
      // which is not where stepping through the list should land.
      if (isDesktop && !nextMessage.flags.draft) {
        router.replace(`/conversation/${nextMessage._id}`);
      }
    }
  }, [currentIndex, messages, router, isDesktop]);

  const handlePrevMessage = useCallback(() => {
    if (currentIndex > 0) {
      const prevMessage = messages[currentIndex - 1];
      useEmailStore.setState({ selectedMessageId: prevMessage._id });
      // A draft is selected but not opened: opening it means the composer,
      // which is not where stepping through the list should land.
      if (isDesktop && !prevMessage.flags.draft) {
        router.replace(`/conversation/${prevMessage._id}`);
      }
    }
  }, [currentIndex, messages, router, isDesktop]);

  const handleToggleStar = useCallback(() => {
    if (selectedMessageId && currentMessage) {
      toggleStar.mutate({
        messageId: selectedMessageId,
        starred: !currentMessage.flags.starred,
      });
    }
  }, [selectedMessageId, currentMessage, toggleStar]);

  const handleMarkUnread = useCallback(() => {
    if (selectedMessageId) {
      toggleRead.mutate({ messageId: selectedMessageId, seen: false });
    }
  }, [selectedMessageId, toggleRead]);

  const helpControl = useDialogControl();
  const handleShowHelp = useCallback(() => {
    helpControl.open();
  }, [helpControl]);

  // Register keyboard shortcuts (web only)
  useKeyboardShortcuts({
    onCompose: handleCompose,
    onReply: handleReply,
    onReplyAll: handleReplyAll,
    onForward: handleForward,
    onArchive: handleArchive,
    onDelete: handleDelete,
    onNextMessage: handleNextMessage,
    onPrevMessage: handlePrevMessage,
    onToggleStar: handleToggleStar,
    onMarkUnread: handleMarkUnread,
    onShowHelp: handleShowHelp,
    enabled: isDesktop,
  });

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
          animation: isDesktop ? 'none' : 'default',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="[view]" />
        <Stack.Screen name="label/[name]" />
        <Stack.Screen name="conversation/[id]" />
        <Stack.Screen name="compose" />
      </Stack>
      <KeyboardShortcutsHelp control={helpControl} />
    </>
  );
}
