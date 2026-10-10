import { useIsDesktopLayout } from '@/hooks/useIsDesktopLayout';
/** A stable route stack preserves drafts and list state when the shell changes width. */

import { useDialogControl } from '@oxy.so/bloom';
import { useOxy } from '@oxy.so/services';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useCallback, useMemo } from 'react';

import { KeyboardShortcutsHelp } from '@/components/KeyboardShortcutsHelp';
import { useSearchFocus } from '@/contexts/search-focus-context';
import { useToggleStar } from '@/hooks/mutations/useMessageMutations';
import { useCurrentList } from '@/hooks/useCurrentList';
import { useEmailStore } from '@/hooks/useEmail';
import { useMessageActions } from '@/hooks/useMessageActions';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useLeaveRemovedRows } from '@/hooks/useLeaveRemovedRows';
import { buildReplyRecipients, joinAddresses, type ReplyMode } from '@/utils/replyRecipients';
import { messageRoute } from '@/utils/messageRoute';

export default function InboxLayout() {
  const router = useRouter();
  const { user } = useOxy();
  const isDesktop = useIsDesktopLayout();
  const segments = useSegments();
  const selectedMessageId = useEmailStore((s) => s.selectedMessageId);

  // The list as it is on screen — the same view, the same conversation rows.
  const { rows, conversationOf } = useCurrentList();
  const messageActions = useMessageActions();
  const toggleStar = useToggleStar();

  // The row that holds the selected message. In conversation view a row is
  // named by its newest message, so a reply arriving in the open conversation
  // renamed it — and a conversation opened by an older message (from search,
  // a reminder, a notification) never had the row's name. Every shortcut then
  // did nothing, and `j` jumped to the top.
  const currentIndex = useMemo(() => {
    if (!selectedMessageId) return -1;
    const exact = rows.findIndex((m) => m._id === selectedMessageId);
    if (exact !== -1) return exact;
    return rows.findIndex((row) =>
      conversationOf(row._id).some((m) => m._id === selectedMessageId),
    );
  }, [selectedMessageId, rows, conversationOf]);

  const currentMessage = useMemo(() => {
    if (currentIndex === -1) return null;
    return rows[currentIndex] ?? null;
  }, [currentIndex, rows]);

  /** Select a row and, on desktop, show it. Used by j/k. */
  const showRow = useCallback(
    (row: (typeof rows)[number]) => {
      useEmailStore.setState({ selectedMessageId: row._id });
      if (!isDesktop) return;
      // A draft is selected but not opened: opening it means the composer,
      // which is not where stepping through the list should land.
      if (!row.flags.draft) router.replace(`/conversation/${row._id}`);
    },
    [isDesktop, router],
  );

  const leaveRemovedRows = useLeaveRemovedRows();

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
    [selectedMessageId, currentMessage, router, isDesktop, user?.username, user?.email],
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
    const conversation = conversationOf(currentMessage._id);
    leaveRemovedRows(conversation.map((m) => m._id));
    messageActions.archive(conversation);
  }, [currentMessage, leaveRemovedRows, messageActions, conversationOf]);

  const handleDelete = useCallback(() => {
    if (!currentMessage) return;
    const conversation = conversationOf(currentMessage._id);
    leaveRemovedRows(conversation.map((m) => m._id));
    messageActions.deleteConversation(conversation);
  }, [currentMessage, leaveRemovedRows, messageActions, conversationOf]);

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

  // `/`, as the help lists it: the search tab, with its input focused.
  const { focusInput } = useSearchFocus();
  const handleFocusSearch = useCallback(() => {
    router.navigate('/search');
    focusInput();
  }, [router, focusInput]);

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
    onFocusSearch: handleFocusSearch,
    // Only on a list or a conversation of this stack. The layout stays mounted
    // under every other screen — Search, Settings, Subscriptions, the
    // composer — where `j` used to navigate away and `e` archived a message
    // that was not on screen.
    enabled: isDesktop && segments.includes('(inbox)') && !segments.includes('compose'),
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

// A failure in this section stays in this section.
export { RouteErrorBoundary as ErrorBoundary } from '@/components/RouteErrorBoundary';
