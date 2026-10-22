import { Screen } from '@oxy.so/bloom/screen';
import { EmptyState } from '@oxy.so/bloom/empty-state';
import { Text } from '@oxy.so/bloom/typography';
import { useMailboxScrollRestoration } from '@/hooks/useMailboxScrollRestoration';
import { useAppShell } from '@oxy.so/bloom/app-shell';
import { ButtonGroup, ButtonGroupItem } from '@oxy.so/bloom/button-group';
import { RiAddLine } from '@oxy.so/bloom/icons/RiAddLine';
import { RiMenuLine } from '@oxy.so/bloom/icons/RiMenuLine';
import { RiSearchLine } from '@oxy.so/bloom/icons/RiSearchLine';
import { PageHeader } from '@oxy.so/bloom/page-header';
/**
 * Routed mailbox list with Bloom page chrome and pull-to-refresh.
 * The shell owns the content width on every platform.
 */

import { toast } from '@oxy.so/bloom/toast';
import { OxySignInButton, useOxy } from '@oxy.so/services/ui/client';
import { FlashList, type FlashListProps, type FlashListRef } from '@shopify/flash-list';
import { useQueryClient } from '@tanstack/react-query';
import { useIsFocused, useRouter } from 'expo-router';

import type React from 'react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { type AnimatedProps } from 'react-native-reanimated';

import { BundleRow } from '@/components/BundleRow';
import { CreateReminderSheet } from '@/components/CreateReminderSheet';
import { EmptyStateSticker } from '@/components/EmptyStateSticker';
import { DailyBrief } from '@/components/DailyBrief';
import { MessageRow } from '@/components/MessageRow';
import { UndeliveredBanner } from '@/components/UndeliveredBanner';
import { ReminderRow } from '@/components/ReminderRow';
import { SelectionToolbar } from '@/components/SelectionToolbar';
import { SnoozeSheet } from '@/components/SnoozeSheet';
import { SwipeableRow } from '@/components/SwipeableRow';
import { UnreadableMessageRow } from '@/components/UnreadableMessageRow';
import { SPACING } from '@/constants/layout';
import { SPECIAL_USE } from '@/constants/mailbox';
import { useColors } from '@/constants/theme';
import { useInboxPrefs, type SwipeAction } from '@/contexts/inbox-prefs-context';
import { useBulkUpdateFlags, useTogglePin } from '@/hooks/mutations/useMessageMutations';
import { useDeleteReminder, useUpdateReminder } from '@/hooks/mutations/useReminderMutations';
import { emailKeys } from '@/hooks/queries/queryKeys';

import { useDailyBrief } from '@/hooks/queries/useDailyBrief';
import { useBundles } from '@/hooks/queries/useBundles';
import { useMailboxes } from '@/hooks/queries/useMailboxes';
import { useReminders } from '@/hooks/queries/useReminders';
import { useBatchSentimentAnalysis } from '@/hooks/queries/useSentimentAnalysis';
import { useEmailStore } from '@/hooks/useEmail';
import { useInboxDisplayPrefs } from '@/hooks/useInboxDisplayPrefs';
import { useMessageActions } from '@/hooks/useMessageActions';
import { useLeaveRemovedRows } from '@/hooks/useLeaveRemovedRows';
import { calendarDaysBetween } from '@oxy.so/utils/date';
import { useTranslation, type TranslateFn } from '@/lib/i18n';
import type { InboxDailyBriefAction } from '@/services/inboxInferenceApi';
import type { Bundle, Message, Reminder, UnreadableMessage } from '@/services/emailApi';
import { messageRoute } from '@/utils/messageRoute';
import { followSelectedRows } from '@/utils/threadGrouping';
import { useCurrentList } from '@/hooks/useCurrentList';
import { useScopedState } from '@/hooks/useScopedState';
import { PrivateInboxContent } from '@/components/PrivateInboxContent';
import type { InboxAliaRequest } from './InboxAlia';

import { AliaAvatarIcon } from '@alia.onl/sdk/avatar';

const InboxAlia = lazy(() => import('./InboxAlia'));

type ListItem =
  | { type: 'header'; title: string; key: string; count?: number }
  | { type: 'message'; data: Message }
  | { type: 'bundle'; bundle: Bundle; messages: Message[]; unreadCount: number }
  | { type: 'reminder'; data: Reminder }
  | { type: 'unreadable'; data: UnreadableMessage; key: string };

/** FlashList wrapped once so Bloom's scroll worklet stays on the UI thread. */
const AnimatedInboxList = Animated.createAnimatedComponent(
  FlashList as React.ComponentType<
    FlashListProps<ListItem> & React.RefAttributes<FlashListRef<ListItem>>
  >,
) as React.ComponentType<
  AnimatedProps<FlashListProps<ListItem>> & React.RefAttributes<FlashListRef<ListItem>>
>;

/** Section title for a message: one card per calendar bucket. */
function getDateCategory(dateStr: string, t: TranslateFn): string {
  const diffDays = calendarDaysBetween(new Date(dateStr), new Date());

  if (diffDays === 0) return t('inbox.sections.today');
  if (diffDays === 1) return t('inbox.sections.yesterday');
  if (diffDays < 7) return t('inbox.sections.thisWeek');
  if (diffDays < 30) return t('inbox.sections.thisMonth');
  return t('inbox.sections.earlier');
}

/**
 * Pushes a titled section: one list item holding the whole group, rendered as
 * a Bloom `SettingsListGroup` card with its title above it.
 *
 * The group is a single FlashList item, so its rows are not individually
 * virtualized — acceptable because a group spans one date bucket of one page,
 * and it is the price of framing each section with a shared card component
 * instead of hand-rolling per-row borders.
 */
function pushGroup(items: ListItem[], title: string, key: string, messages: Message[]): void {
  if (messages.length === 0) return;
  // One list item per message, not one per bucket. FlashList mounts an item
  // whole, so a bucket-sized item would mount every message in it — the
  // "Earlier" bucket spans page boundaries and reaches hundreds of rows. The
  // section reads as a group through its heading and the per-row spacing; it
  // never had a surface of its own to hold it together.
  if (title) items.push({ type: 'header', title, key, count: messages.length });
  for (const msg of messages) items.push({ type: 'message', data: msg });
}

/** Splits messages into consecutive date buckets, preserving list order. */
function groupByDate(
  messages: Message[],
  t: TranslateFn,
): { title: string; messages: Message[] }[] {
  const groups: { title: string; messages: Message[] }[] = [];
  for (const msg of messages) {
    const title = getDateCategory(msg.date, t);
    const current = groups[groups.length - 1];
    if (current && current.title === title) {
      current.messages.push(msg);
      continue;
    }
    groups.push({ title, messages: [msg] });
  }
  return groups;
}

interface InboxListProps {
  /** When true, uses router.replace for message navigation (desktop split-view) */
  replaceNavigation?: boolean;
}

export function InboxList({ replaceNavigation }: InboxListProps) {
  const router = useRouter();
  const shell = useAppShell();
  const focused = useIsFocused();
  const drawerAvailable = shell.drawerAvailable;
  const colors = useColors();
  const { t } = useTranslation();
  const { isAuthenticated, user, canUsePrivateApi, isAccountCacheReady } = useOxy();
  const accountReady = canUsePrivateApi && isAccountCacheReady;
  const accountScope = accountReady ? (user?.id ?? null) : null;
  const [aliaRequest, setAliaRequest] = useScopedState<InboxAliaRequest | null>(
    accountScope,
    () => null,
  );
  const handleBriefAction = useCallback(
    (action: InboxDailyBriefAction) => {
      setAliaRequest({ action });
    },
    [setAliaRequest],
  );
  const { prefs } = useInboxPrefs();
  const { density, showPreviews } = useInboxDisplayPrefs();
  const messageActions = useMessageActions();

  const currentMailbox = useEmailStore((s) => s.currentMailbox);
  const viewMode = useEmailStore((s) => s.viewMode);
  const selectedMessageId = useEmailStore((s) => s.selectedMessageId);
  const isSelectionMode = useEmailStore((s) => s.isSelectionMode);
  const selectedMessageIds = useEmailStore((s) => s.selectedMessageIds);
  const toggleMessageSelection = useEmailStore((s) => s.toggleMessageSelection);
  const enterSelectionMode = useEmailStore((s) => s.enterSelectionMode);
  const clearSelection = useEmailStore((s) => s.clearSelection);
  const selectAll = useEmailStore((s) => s.selectAll);

  const {
    data: mailboxes = [],
    isError: mailboxesFailed,
    refetch: refetchMailboxes,
  } = useMailboxes();

  const {
    query: { isLoading, isError, isFetchingNextPage, refetch, fetchNextPage, hasNextPage },
    options: messagesOptions,
    listReady,
    messages,
    unreadable,
    rows: displayMessages,
    conversationOf: listConversationOf,
  } = useCurrentList();
  const bundleView = useEmailStore((s) => s.bundleView);
  const expandedBundles = useEmailStore((s) => s.expandedBundles);
  const toggleBundle = useEmailStore((s) => s.toggleBundle);

  const togglePin = useTogglePin();
  const bulkFlags = useBulkUpdateFlags();
  const queryClient = useQueryClient();
  // A brief may name older mail outside the loaded list pages. Its live detail
  // query supplies the same mutation target without fetching the list again.
  const conversationOf = useCallback(
    (id: string): Message[] => {
      const members = listConversationOf(id);
      if (members.length) return members;
      const message = queryClient.getQueryData<Message | null>(
        emailKeys.message.detail(id, user?.id ?? null),
      );
      return message ? [message] : [];
    },
    [listConversationOf, queryClient, user?.id],
  );
  const { data: bundles = [] } = useBundles();

  const [snoozeTargetId, setSnoozeTargetId] = useScopedState<string | null>(
    accountScope,
    () => null,
  );
  const [editReminderTarget, setEditReminderTarget] = useScopedState<Reminder | null>(
    accountScope,
    () => null,
  );

  const { data: remindersResult } = useReminders();
  const reminders = useMemo(() => remindersResult?.data ?? [], [remindersResult]);
  // Which reminders are due is decided as of this clock, moved on when the
  // next one comes due: decided once per render of the list, a reminder that
  // came due while it was open stayed among the upcoming ones.
  const [reminderClock, setReminderClock] = useState(() => Date.now());
  const nextReminderDue = useMemo(() => {
    const upcoming = reminders
      .filter((r) => !r.completed)
      .map((r) => Date.parse(r.remindAt))
      .filter((at) => at > reminderClock);
    return upcoming.length > 0 ? Math.min(...upcoming) : null;
  }, [reminders, reminderClock]);
  useEffect(() => {
    if (nextReminderDue === null) return;
    // Capped: a timer far in the future overflows, and a sleeping device is late.
    const delay = Math.min(Math.max(nextReminderDue - Date.now(), 0) + 50, 60 * 60_000);
    const timer = setTimeout(() => setReminderClock(Date.now()), delay);
    return () => clearTimeout(timer);
  }, [nextReminderDue]);

  const updateReminderMutation = useUpdateReminder();
  const deleteReminderMutation = useDeleteReminder();

  const isInboxView =
    viewMode?.type === 'mailbox'
      ? viewMode.mailbox.specialUse === SPECIAL_USE.INBOX
      : // No view chosen yet: the list falls back to the Inbox (useCurrentList).
        !viewMode && (currentMailbox ? currentMailbox.specialUse === SPECIAL_USE.INBOX : true);
  const isSnoozedView =
    viewMode?.type === 'mailbox'
      ? viewMode.mailbox.specialUse === SPECIAL_USE.SNOOZED
      : !viewMode && currentMailbox?.specialUse === SPECIAL_USE.SNOOZED;
  const showBundles = bundleView && isInboxView && bundles.length > 0;

  // Sentiment is an inexpensive local heuristic, and is additionally gated by
  // the existing user-facing categorization preference. It is not an AI call.
  const sentimentMap = useBatchSentimentAnalysis(displayMessages, prefs.aiCategorization);

  const briefHeading = (!accountReady || isInboxView) && prefs.aiBrief;
  const briefVisible = accountReady && isInboxView && prefs.aiBrief;
  const { brief, error: briefError } = useDailyBrief({ enabled: briefVisible });
  // Messages in the brief card appear once, instead of repeating below it.
  const shownAboveIds = useMemo(
    () => new Set(briefVisible && !briefError ? brief?.items.map((item) => item.messageId) : []),
    [brief, briefError, briefVisible],
  );

  const listItems = useMemo<ListItem[]>(() => {
    if (displayMessages.length === 0 && reminders.length === 0 && unreadable.length === 0) {
      return [];
    }
    const items: ListItem[] = [];

    // Rows the API sent that this client could not read. First, so a message
    // that failed to render is noticed rather than silently missing.
    if (unreadable.length > 0) {
      items.push({
        type: 'header',
        title: t('inbox.unreadable.section'),
        key: 'header-Unreadable',
        count: unreadable.length,
      });
      unreadable.forEach((row, index) => {
        items.push({
          type: 'unreadable',
          data: row,
          key: `unreadable-${row._id ?? index}`,
        });
      });
    }

    // Due/active reminders at the top (only in inbox view)
    if (isInboxView && reminders.length > 0) {
      const dueReminders = reminders.filter(
        (r) => !r.completed && Date.parse(r.remindAt) <= reminderClock,
      );
      const upcomingReminders = reminders.filter(
        (r) => !r.completed && Date.parse(r.remindAt) > reminderClock,
      );

      if (dueReminders.length > 0) {
        items.push({
          type: 'header',
          title: t('inbox.sections.reminders'),
          key: 'header-Reminders',
        });
        for (const r of dueReminders) {
          items.push({ type: 'reminder', data: r });
        }
      }
      if (upcomingReminders.length > 0 && upcomingReminders.length <= 3) {
        if (dueReminders.length === 0) {
          items.push({
            type: 'header',
            title: t('inbox.sections.reminders'),
            key: 'header-Reminders',
          });
        }
        for (const r of upcomingReminders) {
          items.push({ type: 'reminder', data: r });
        }
      }
    }

    // Partition pinned messages to top (only in mailbox views, not snoozed)
    const remainingMessages = displayMessages.filter((message) => !shownAboveIds.has(message._id));
    const pinned = !isSnoozedView ? remainingMessages.filter((m) => m.flags.pinned) : [];
    const unpinned = !isSnoozedView
      ? remainingMessages.filter((m) => !m.flags.pinned)
      : remainingMessages;

    pushGroup(items, t('inbox.sections.pinned'), 'header-Pinned', pinned);

    // Bundle view: group by bundle labels
    if (showBundles) {
      const enabledBundles = bundles.filter((b) => b.enabled);
      const bundledLabels = new Set<string>();
      for (const b of enabledBundles) {
        for (const l of b.matchLabels) bundledLabels.add(l);
      }

      const primaryMsgs: Message[] = [];
      const bundleMap = new Map<string, Message[]>();
      for (const b of enabledBundles) bundleMap.set(b._id, []);

      for (const msg of unpinned) {
        let matched = false;
        for (const b of enabledBundles) {
          if (b.matchLabels.some((l) => msg.labels.includes(l))) {
            const bucket = bundleMap.get(b._id);
            if (bucket) {
              bucket.push(msg);
              matched = true;
              break;
            }
          }
        }
        if (!matched) primaryMsgs.push(msg);
      }

      for (const group of groupByDate(primaryMsgs, t)) {
        pushGroup(items, group.title, `header-${group.title}`, group.messages);
      }

      // Bundle rows (collapsed or expanded)
      for (const b of enabledBundles) {
        const msgs = bundleMap.get(b._id) || [];
        if (msgs.length === 0) continue;
        const unreadCount = msgs.filter((m) => !m.flags.seen).length;
        items.push({ type: 'bundle', bundle: b, messages: msgs, unreadCount });

        if (expandedBundles.has(b._id)) {
          for (const msg of msgs) items.push({ type: 'message', data: msg });
        }
      }
    } else {
      for (const group of groupByDate(unpinned, t)) {
        pushGroup(items, group.title, `header-${group.title}`, group.messages);
      }
    }

    return items;
  }, [
    bundles,
    displayMessages,
    expandedBundles,
    isInboxView,
    isSnoozedView,
    reminderClock,
    reminders,
    showBundles,
    shownAboveIds,
    t,
    unreadable,
  ]);

  // Clear the selection when the user goes to another view. Keyed by WHICH
  // view, not by the view object: that is rebuilt whenever the mailboxes are
  // refetched (every new mail bumps an unread count), and each rebuild wiped a
  // selection the user was in the middle of making.
  const viewKey =
    viewMode?.type === 'mailbox'
      ? `mailbox:${viewMode.mailbox._id}`
      : viewMode?.type === 'label'
        ? `label:${viewMode.labelId}`
        : (viewMode?.type ?? 'none');
  // biome-ignore lint/correctness/useExhaustiveDependencies: viewKey is the trigger — the selection clears when the view changes.
  useEffect(() => {
    clearSelection();
  }, [viewKey, clearSelection]);

  // The selection follows its conversations when their rows change: a reply
  // renames a conversation row, an archive elsewhere removes one.
  useEffect(() => {
    if (selectedMessageIds.size === 0) return;
    const next = followSelectedRows(
      selectedMessageIds,
      displayMessages,
      listConversationOf,
      shownAboveIds,
    );
    if (next) selectAll([...next]);
  }, [selectedMessageIds, displayMessages, listConversationOf, shownAboveIds, selectAll]);

  // The spinner is the pull's, not every refetch's: background polls, socket
  // events and mutations refetch too, and the spinner popped up for each.
  const [pulling, setPulling] = useScopedState(accountScope, () => false);
  const handleRefresh = useCallback(() => {
    setPulling(true);
    void refetch().finally(() => setPulling(false));
  }, [refetch, setPulling]);

  const handleLoadMore = useCallback(() => {
    if (isFetchingNextPage || !hasNextPage) return;
    fetchNextPage();
  }, [fetchNextPage, isFetchingNextPage, hasNextPage]);

  // Pin state is the conversation's, as the row shows it: unpinning unpins
  // every pinned message in it, pinning pins the row's own message.
  const handlePin = useCallback(
    (rowId: string) => {
      if (togglePin.isPending) return;
      const row = displayMessages.find((m) => m._id === rowId) ?? conversationOf(rowId)[0];
      if (!row) return;
      if (!row.flags.pinned) {
        togglePin.mutate({ messageId: rowId, pinned: true });
        return;
      }
      const pinned = conversationOf(rowId).filter((m) => m.flags.pinned);
      if (pinned.length === 1) {
        togglePin.mutate({ messageId: pinned[0]._id, pinned: false });
        return;
      }
      // One request and one re-read for the conversation. It was a request and
      // a full re-read of every view per message. Re-read, not just marked
      // stale, as for one: an unpin moves the rows (the API lists pins first).
      bulkFlags.mutate(
        { messageIds: pinned.map((m) => m._id), flags: { pinned: false }, quiet: true },
        {
          onSettled: () =>
            void queryClient.invalidateQueries({ queryKey: emailKeys.messages.root }),
        },
      );
    },
    [displayMessages, conversationOf, togglePin, bulkFlags, queryClient],
  );

  const handleToggleRead = useCallback(
    (rowId: string, seen: boolean) => messageActions.setRead(conversationOf(rowId), seen),
    [conversationOf, messageActions],
  );

  // Off the conversation first if it is the one open, so the reading pane
  // follows the selection to its neighbour.
  const leaveRemovedRows = useLeaveRemovedRows();
  const removing = useCallback(
    (conversation: Message[]) => {
      leaveRemovedRows(conversation.map((m) => m._id));
      return conversation;
    },
    [leaveRemovedRows],
  );

  const handleArchiveRow = useCallback(
    (rowId: string) => messageActions.archive(removing(conversationOf(rowId))),
    [conversationOf, messageActions, removing],
  );

  const handleDeleteRow = useCallback(
    (rowId: string) => messageActions.deleteConversation(removing(conversationOf(rowId))),
    [conversationOf, messageActions, removing],
  );

  const handleSnooze = useCallback(
    (until: Date) => {
      if (!snoozeTargetId) return;
      messageActions.snooze(removing(conversationOf(snoozeTargetId)), until.toISOString());
      setSnoozeTargetId(null);
    },
    [snoozeTargetId, conversationOf, messageActions, removing, setSnoozeTargetId],
  );

  const handleToggleReminderComplete = useCallback(
    (reminderId: string, completed: boolean) => {
      updateReminderMutation.mutate({ reminderId, completed });
    },
    [updateReminderMutation],
  );

  const handleDeleteReminder = useCallback(
    (reminderId: string) => {
      deleteReminderMutation.mutate(reminderId);
    },
    [deleteReminderMutation],
  );

  const handleReminderPress = useCallback(
    (reminderId: string) => {
      const reminder = reminders.find((r) => r._id === reminderId);
      if (!reminder) return;
      // Reminders created from an email open that conversation; standalone
      // reminders open the edit sheet to reschedule / edit text.
      if (reminder.relatedMessageId) {
        if (replaceNavigation) {
          router.replace(`/conversation/${reminder.relatedMessageId}`);
        } else {
          router.push(`/conversation/${reminder.relatedMessageId}`);
        }
        return;
      }
      setEditReminderTarget(reminder);
    },
    [reminders, router, replaceNavigation, setEditReminderTarget],
  );

  const handleUpdateReminder = useCallback(
    (text: string, remindAt: Date) => {
      if (!editReminderTarget) return;
      updateReminderMutation.mutate({
        reminderId: editReminderTarget._id,
        text,
        remindAt: remindAt.toISOString(),
      });
      setEditReminderTarget(null);
    },
    [editReminderTarget, updateReminderMutation, setEditReminderTarget],
  );

  const handleMessagePress = useCallback(
    (message: Message) => {
      const route = messageRoute(message);
      if (message.flags.draft) {
        // The composer is pushed over the list rather than replacing the
        // reading pane, so closing it returns to where the user was.
        router.push(route);
        return;
      }
      messageActions.prepareOpenMessage(message._id);
      if (replaceNavigation) {
        router.replace(route);
      } else {
        router.push(route);
      }
    },
    [router, replaceNavigation, messageActions],
  );

  // Not `handleMessagePress`: that primes caches from a parsed `Message`, which
  // an unreadable row by definition is not, and a row of the brief does not have.
  const openMessageById = useCallback(
    (messageId: string) => {
      if (replaceNavigation) {
        router.replace(`/conversation/${messageId}`);
      } else {
        router.push(`/conversation/${messageId}`);
      }
    },
    [router, replaceNavigation],
  );

  const handleOpenDrawer = shell.openDrawer;

  const handleAskAlia = useCallback(() => {
    setAliaRequest({});
  }, [setAliaRequest]);

  const handleSearch = useCallback(() => {
    router.push('/search');
  }, [router]);

  const handleLongPress = useCallback(
    (id: string) => {
      enterSelectionMode(id);
    },
    [enterSelectionMode],
  );

  // Bulk actions act on every conversation selected, all of its messages.
  const selectedConversations = useCallback(
    () => [...selectedMessageIds].flatMap(conversationOf),
    [selectedMessageIds, conversationOf],
  );
  /** The rows as shown: a row is unread when any message in it is. */
  const selectedRows = useCallback(
    () => displayMessages.filter((m) => selectedMessageIds.has(m._id)),
    [displayMessages, selectedMessageIds],
  );

  const handleBulkArchive = useCallback(() => {
    messageActions.archive(removing(selectedConversations()));
    clearSelection();
  }, [messageActions, selectedConversations, clearSelection, removing]);

  const handleBulkDelete = useCallback(() => {
    if (!mailboxes.some((m) => m.specialUse === SPECIAL_USE.TRASH)) {
      toast.error(t('inbox.toast.trashUnavailable'));
      return;
    }
    messageActions.deleteConversation(removing(selectedConversations()));
    clearSelection();
  }, [messageActions, selectedConversations, clearSelection, mailboxes, t, removing]);

  const handleBulkStar = useCallback(() => {
    const shouldStar = selectedRows().some((m) => !m.flags.starred);
    bulkFlags.mutate({
      messageIds: selectedConversations().map((m) => m._id),
      flags: { starred: shouldStar },
    });
    clearSelection();
  }, [selectedRows, selectedConversations, bulkFlags, clearSelection]);

  const handleBulkMarkRead = useCallback(() => {
    // Decided from the rows as displayed. It used to read the raw messages, in
    // which a conversation row's own message is often already read, and so
    // "Mark read" on an unread conversation marked it UNREAD.
    const shouldMarkRead = selectedRows().some((m) => !m.flags.seen);
    messageActions.setRead(selectedConversations(), shouldMarkRead);
    clearSelection();
  }, [selectedRows, selectedConversations, messageActions, clearSelection]);

  // Derive title from view mode
  const mailboxTitle = useMemo(() => {
    if (viewMode?.type === 'starred') return t('drawer.starred');
    if (viewMode?.type === 'label') return viewMode.labelName;
    if (currentMailbox?.specialUse === SPECIAL_USE.INBOX) return t('drawer.mailboxes.Inbox');
    if (currentMailbox?.specialUse === SPECIAL_USE.SENT) return t('drawer.mailboxes.Sent');
    if (currentMailbox?.specialUse === SPECIAL_USE.DRAFTS) return t('drawer.mailboxes.Drafts');
    if (currentMailbox?.specialUse === SPECIAL_USE.TRASH) return t('drawer.mailboxes.Trash');
    if (currentMailbox?.specialUse === SPECIAL_USE.SPAM) return t('drawer.mailboxes.Spam');
    if (currentMailbox?.specialUse === SPECIAL_USE.ARCHIVE) return t('drawer.mailboxes.Archive');
    if (currentMailbox?.specialUse === SPECIAL_USE.SNOOZED) return t('drawer.mailboxes.Snoozed');
    return currentMailbox?.name || t('drawer.mailboxes.Inbox');
  }, [currentMailbox, t, viewMode]);

  // Single entry point for swipe actions. `SwipeableRow` only knows which
  // action the user configured; the behaviour lives here via `useMessageActions`.
  const handleSwipeAction = useCallback(
    (action: SwipeAction, messageId: string) => {
      switch (action) {
        case 'archive':
          handleArchiveRow(messageId);
          break;
        case 'delete':
          handleDeleteRow(messageId);
          break;
        case 'mark-read':
          handleToggleRead(messageId, true);
          break;
        case 'snooze':
          setSnoozeTargetId(messageId);
          break;
        case 'none':
          break;
      }
    },
    [handleArchiveRow, handleDeleteRow, handleToggleRead, setSnoozeTargetId],
  );

  /** One message row, shared by the flat items and the grouped panels. */
  const pinPendingId =
    togglePin.isPending && togglePin.variables?.messageId ? togglePin.variables.messageId : null;

  const listExtraData = useMemo(
    () => ({
      selectedMessageIds,
      selectedMessageId,
      isSelectionMode,
      pinPendingId,
      isSnoozedView,
      expandedBundles,
      density,
      showPreviews,
      themeKey: `${colors.unread}|${colors.surface}|${colors.surfaceVariant}|${colors.secondaryText}|${colors.primary}|${colors.border}`,
    }),
    [
      selectedMessageIds,
      selectedMessageId,
      isSelectionMode,
      pinPendingId,
      isSnoozedView,
      expandedBundles,
      density,
      showPreviews,
      colors.unread,
      colors.surface,
      colors.surfaceVariant,
      colors.secondaryText,
      colors.border,
      colors.primary,
    ],
  );

  const renderMessageRow = useCallback(
    (msg: Message, note?: string, onOpen?: () => void) => (
      <SwipeableRow
        key={msg._id}
        messageId={msg._id}
        leftAction={prefs.leftSwipeAction}
        rightAction={prefs.rightSwipeAction}
        onAction={handleSwipeAction}
        archived={messageActions.isArchived(conversationOf(msg._id))}
      >
        <MessageRow
          message={msg}
          onPin={handlePin}
          onSelect={onOpen ?? handleMessagePress}
          snippetOverride={note}
          onArchive={handleArchiveRow}
          archived={messageActions.isArchived(conversationOf(msg._id))}
          onDelete={handleDeleteRow}
          onToggleRead={handleToggleRead}
          isSelected={msg._id === selectedMessageId}
          isSelectionMode={isSelectionMode}
          isMultiSelected={selectedMessageIds.has(msg._id)}
          onToggleSelect={toggleMessageSelection}
          onLongPress={handleLongPress}
          isPinPending={pinPendingId === msg._id}
          showSnoozeTime={isSnoozedView}
          density={density}
          showPreviews={showPreviews}
          sentiment={sentimentMap.get(msg._id)}
        />
      </SwipeableRow>
    ),
    [
      prefs.leftSwipeAction,
      prefs.rightSwipeAction,
      handleSwipeAction,
      handlePin,
      handleMessagePress,
      handleArchiveRow,
      handleDeleteRow,
      handleToggleRead,
      selectedMessageId,
      isSelectionMode,
      selectedMessageIds,
      toggleMessageSelection,
      handleLongPress,
      pinPendingId,
      isSnoozedView,
      density,
      showPreviews,
      sentimentMap,
      messageActions,
      conversationOf,
    ],
  );

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.type === 'header') {
        return (
          <View style={styles.sectionHeader} accessibilityRole="header">
            <Text style={[styles.sectionHeaderText, { color: colors.secondaryText }]}>
              {item.title}
            </Text>
            {item.count !== undefined ? (
              <Text style={[styles.sectionHeaderCount, { color: colors.secondaryText }]}>
                {item.count}
              </Text>
            ) : null}
          </View>
        );
      }
      if (item.type === 'unreadable') {
        return (
          <View style={styles.messageItem}>
            <UnreadableMessageRow message={item.data} onOpen={openMessageById} />
          </View>
        );
      }
      if (item.type === 'bundle') {
        return (
          <BundleRow
            bundle={item.bundle}
            messages={item.messages}
            unreadCount={item.unreadCount}
            isExpanded={expandedBundles.has(item.bundle._id)}
            onToggle={() => toggleBundle(item.bundle._id)}
          />
        );
      }
      if (item.type === 'reminder') {
        return (
          <ReminderRow
            reminder={item.data}
            onToggleComplete={handleToggleReminderComplete}
            onPress={handleReminderPress}
            onDelete={handleDeleteReminder}
          />
        );
      }
      return <View style={styles.messageItem}>{renderMessageRow(item.data)}</View>;
    },
    // Only what this function itself reads. It used to re-list
    // `renderMessageRow`'s own dependencies by hand while omitting
    // `renderMessageRow` — so the copy had to be kept in sync manually, and
    // every row kept whichever callbacks it closed over when the copy last
    // happened to change.
    [
      colors.secondaryText,
      expandedBundles,
      handleDeleteReminder,
      openMessageById,
      handleReminderPress,
      handleToggleReminderComplete,
      renderMessageRow,
      toggleBundle,
    ],
  );

  const getItemType = useCallback((item: ListItem) => item.type, []);

  const keyExtractor = useCallback((item: ListItem) => {
    if (item.type === 'header') return item.key;
    if (item.type === 'bundle') return `bundle-${item.bundle._id}`;
    if (item.type === 'reminder') return `reminder-${item.data._id}`;
    if (item.type === 'unreadable') return item.key;
    return item.data._id;
  }, []);

  const listRef = useRef<FlashListRef<ListItem>>(null);
  const onListScroll = useMailboxScrollRestoration(
    listRef,
    JSON.stringify(['mailbox', user?.id, messagesOptions]),
    focused && listItems.length > 0,
  );

  const renderEmpty = useCallback(() => {
    // The list waits for the mailboxes to know which folder to read. If those
    // failed, it would wait forever on a blank screen: say so, and retry both.
    const mailboxesUnavailable = isAuthenticated && !listReady && mailboxesFailed;
    // Not "loading" to React Query while the list is still waiting for a
    // mailbox id — but not empty either.
    if (isLoading || (isAuthenticated && !listReady && !mailboxesUnavailable)) return null;
    // A failed load is not "all caught up": with no cache, offline or on a
    // server error, that is what the user used to be told.
    if (isError || mailboxesUnavailable) {
      return (
        <EmptyState
          illustration={<EmptyStateSticker name="loadError" />}
          title={t('inbox.loadErrorTitle')}
          description={t('ui.message.loadErrorDescription')}
          action={{
            label: t('common.retry'),
            onPress: () => {
              if (mailboxesUnavailable) void refetchMailboxes();
              else void refetch();
            },
          }}
        />
      );
    }
    return (
      <EmptyState
        illustration={<EmptyStateSticker name="inbox" />}
        title={t('inbox.emptyTitle')}
        description={isAuthenticated ? t('inbox.emptyAllCaught') : t('inbox.emptySignIn')}
        footer={!isAuthenticated ? <OxySignInButton variant="contained" /> : undefined}
      />
    );
  }, [
    isAuthenticated,
    isLoading,
    isError,
    listReady,
    mailboxesFailed,
    refetch,
    refetchMailboxes,
    t,
  ]);

  return (
    <Screen
      active={focused}
      scroll="none"
      testID="inbox-screen"
      header={
        accountReady && isSelectionMode ? (
          <SelectionToolbar
            count={selectedMessageIds.size}
            onClose={clearSelection}
            onArchive={handleBulkArchive}
            archived={messageActions.isArchived(selectedConversations())}
            onDelete={handleBulkDelete}
            onStar={handleBulkStar}
            onMarkRead={handleBulkMarkRead}
          />
        ) : (
          <View>
            <PageHeader
              title={
                briefHeading
                  ? t('home.todaysBrief')
                  : accountReady
                    ? mailboxTitle
                    : t('drawer.mailboxes.Inbox')
              }
              sticky={false}
              scrim="none"
              safeArea={false}
              leading={
                drawerAvailable ? (
                  <ButtonGroup accessibilityLabel={t('search.openMenu')}>
                    <ButtonGroupItem
                      iconOnly
                      leadingIcon={RiMenuLine}
                      accessibilityLabel={t('search.openMenu')}
                      onPress={handleOpenDrawer}
                    />
                  </ButtonGroup>
                ) : undefined
              }
              actions={
                <ButtonGroup>
                  {accountReady && (
                    <>
                      <ButtonGroupItem
                        iconOnly
                        leadingIcon={RiAddLine}
                        accessibilityLabel={t('inbox.composeFabLabel')}
                        onPress={() => router.push('/compose')}
                      />
                      <ButtonGroupItem leadingIcon={AliaAvatarIcon} onPress={handleAskAlia}>
                        {t('inbox.askAlia')}
                      </ButtonGroupItem>
                    </>
                  )}
                  <ButtonGroupItem
                    iconOnly
                    leadingIcon={RiSearchLine}
                    accessibilityLabel={t('inbox.searchInMailbox', {
                      mailbox: (accountReady
                        ? mailboxTitle
                        : t('drawer.mailboxes.Inbox')
                      ).toLowerCase(),
                    })}
                    onPress={handleSearch}
                  />
                </ButtonGroup>
              }
            />
          </View>
        )
      }
    >
      <PrivateInboxContent>
        <View style={styles.listContainer}>
          <AnimatedInboxList
            ref={listRef}
            data={listItems}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            getItemType={getItemType}
            ListHeaderComponent={
              <>
                <UndeliveredBanner />
                {briefVisible && (
                  <DailyBrief
                    onOpenMessage={openMessageById}
                    onAction={handleBriefAction}
                    messages={messages}
                    renderMessage={renderMessageRow}
                  />
                )}
              </>
            }
            ListEmptyComponent={shownAboveIds.size > 0 ? null : renderEmpty}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            onScroll={onListScroll}
            scrollEventThrottle={16}
            extraData={listExtraData}
            refreshControl={
              <RefreshControl
                refreshing={pulling}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            contentContainerStyle={{
              ...(listItems.length === 0 ? styles.emptyListContent : null),
              ...styles.listContent,
              paddingTop: 0,
              paddingBottom: 0,
            }}
            showsVerticalScrollIndicator={false}
          />
        </View>

        {/* Alia remains available from the inline header action. */}
        {isAuthenticated && aliaRequest && (
          <Suspense fallback={null}>
            <InboxAlia request={aliaRequest} />
          </Suspense>
        )}

        {/* Snooze sheet */}
        <SnoozeSheet
          visible={snoozeTargetId !== null}
          onClose={() => setSnoozeTargetId(null)}
          onSnooze={handleSnooze}
        />

        {/* Edit reminder sheet (opened by tapping a standalone reminder) */}
        <CreateReminderSheet
          visible={editReminderTarget !== null}
          editReminder={editReminderTarget}
          onClose={() => setEditReminderTarget(null)}
          onCreate={handleUpdateReminder}
          onUpdate={handleUpdateReminder}
        />
      </PrivateInboxContent>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    width: '100%',
  },
  listContainer: {
    flex: 1,
    minHeight: 0,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  messageItem: {
    marginHorizontal: SPACING.md,
    // Small gap between messages instead of divider lines. A margin rather
    // than a parent `gap`, now that each row is its own list item.
    marginBottom: SPACING.xs,
  },
  sectionHeader: {
    // Sits above its rows, outside them — hence no border of its own. The count
    // rides here rather than in a global toolbar, so it describes the section
    // it labels. `marginHorizontal` matches `messageItem` so the heading keeps
    // the same left edge as the rows it labels, which it used to inherit from
    // the group wrapper.
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: SPACING.xs,
    marginHorizontal: SPACING.md,
    paddingHorizontal: SPACING.xs,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  sectionHeaderCount: {
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.7,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
