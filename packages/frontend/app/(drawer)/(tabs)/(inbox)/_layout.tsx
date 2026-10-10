import { useIsDesktopLayout } from '@/hooks/useIsDesktopLayout';
/** A stable route stack preserves drafts and list state when the shell changes width. */

import { useDialogControl } from '@oxy.so/bloom';
import { useOxy } from '@oxy.so/services';
import { Stack, usePathname, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';

import { KeyboardShortcutsHelp } from '@/components/KeyboardShortcutsHelp';
import { useToggleStar } from '@/hooks/mutations/useMessageMutations';
import { useCurrentList } from '@/hooks/useCurrentList';
import { useEmailStore } from '@/hooks/useEmail';
import { useMessageActions } from '@/hooks/useMessageActions';
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
  const pathname = usePathname();
  const selectedMessageId = useEmailStore((s) => s.selectedMessageId);

  // The list as it is on screen — the same view, the same conversation rows.
  const { rows, conversationOf } = useCurrentList();
  const messageActions = useMessageActions();
  const toggleStar = useToggleStar();

  const currentIndex = useMemo(() => {
    if (!selectedMessageId) return -1;
    return rows.findIndex((m) => m._id === selectedMessageId);
  }, [selectedMessageId, rows]);

  const currentMessage = useMemo(() => {
    if (currentIndex === -1) return null;
    return rows[currentIndex] ?? null;
  }, [currentIndex, rows]);

  /**
   * Select a row and, on desktop, show it — or show nothing. Used by j/k and
   * after Archive/Delete: the mutation moved the list's selection on, but the
   * reading pane kept showing the message just archived, so the next `e`
   * archived one the user had never seen.
   */
  const showRow = useCallback(
    (row: (typeof rows)[number] | null) => {
      useEmailStore.setState({ selectedMessageId: row?._id ?? null });
      if (!isDesktop) return;
      // A draft is selected but not opened: opening it means the composer,
      // which is not where stepping through the list should land.
      if (!row) router.replace('/');
      else if (!row.flags.draft) router.replace(`/conversation/${row._id}`);
    },
    [isDesktop, router],
  );

  /** The row after the current one, else the one before, else none. */
  const neighbourRow = useCallback(
    () => rows[currentIndex + 1] ?? (currentIndex > 0 ? rows[currentIndex - 1] : null) ?? null,
    [rows, currentIndex],
  );

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
    if (!currentMessage) return;
    const next = neighbourRow();
    messageActions.archive(conversationOf(currentMessage._id));
    showRow(next);
  }, [currentMessage, neighbourRow, messageActions, conversationOf, showRow]);

  const handleDelete = useCallback(() => {
    if (!currentMessage) return;
    const next = neighbourRow();
    messageActions.deleteConversation(conversationOf(currentMessage._id));
    showRow(next);
  }, [currentMessage, neighbourRow, messageActions, conversationOf, showRow]);

  const handleNextMessage = useCallback(() => {
    if (currentIndex < rows.length - 1) showRow(rows[currentIndex + 1]);
  }, [currentIndex, rows, showRow]);

  const handlePrevMessage = useCallback(() => {
    if (currentIndex > 0) showRow(rows[currentIndex - 1]);
  }, [currentIndex, rows, showRow]);

  const handleToggleStar = useCallback(() => {
    if (currentMessage) {
      toggleStar.mutate({
        messageId: currentMessage._id,
        starred: !currentMessage.flags.starred,
      });
    }
  }, [currentMessage, toggleStar]);

  const handleMarkUnread = useCallback(() => {
    if (currentMessage) messageActions.setRead(conversationOf(currentMessage._id), false);
  }, [currentMessage, messageActions, conversationOf]);

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
    // Only where this stack is on screen: the layout stays mounted under the
    // Search and Settings tabs, where `j` used to switch tabs on the user.
    enabled: isDesktop && !pathname.startsWith('/search') && !pathname.startsWith('/settings'),
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
