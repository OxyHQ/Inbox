import { BREAKPOINTS } from '@oxy.so/bloom/styles';
import { useBottomEdgeInset } from '@oxy.so/bloom/layout';
import { EmptyState } from '@oxy.so/bloom/empty-state';
import { Text } from '@oxy.so/bloom/typography';
import { useMailboxScrollRestoration } from '@/hooks/useMailboxScrollRestoration';
import { useAppShell } from '@oxy.so/bloom/app-shell';
import { ButtonGroup, ButtonGroupItem } from '@oxy.so/bloom/button-group';
import { Button } from '@oxy.so/bloom/button';
import { RiAddLine, RiMenuLine, RiSearchLine } from '@oxy.so/bloom/icons';
import { PageHeader } from '@oxy.so/bloom/page-header';
/**
 * Routed mailbox list with Bloom page chrome and pull-to-refresh.
 * The shell owns the content width on every platform.
 */

import { toast } from '@oxy.so/bloom';
import { Loading } from '@oxy.so/bloom/loading';
import { OxySignInButton, useOxy } from '@oxy.so/services';
import {
  FlashList,
  type FlashListProps,
  type FlashListRef,
} from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useWindowDimensions, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { type AnimatedProps } from 'react-native-reanimated';

import { BundleRow } from '@/components/BundleRow';
import { CreateReminderSheet } from '@/components/CreateReminderSheet';
import { EmptyStateSticker } from '@/components/EmptyStateSticker';
import { InboxGreeting } from '@/components/InboxGreeting';
import { MessageRow, MessageRowExtras } from '@/components/MessageRow';
import { OutboundQueueBanner } from '@/components/OutboundQueueBanner';
import { ReminderRow } from '@/components/ReminderRow';
import { SelectionToolbar } from '@/components/SelectionToolbar';
import { SnoozeSheet } from '@/components/SnoozeSheet';
import { SwipeableRow } from '@/components/SwipeableRow';
import { UnreadableMessageRow } from '@/components/UnreadableMessageRow';
import { SPACING } from '@/constants/layout';
import { SPECIAL_USE } from '@/constants/mailbox';
import { useColors } from '@/constants/theme';
import {
  useInboxPrefs,
  type SwipeAction,
} from '@/contexts/inbox-prefs-context';
import {
  useBulkUpdateFlags,
  useTogglePin,
} from '@/hooks/mutations/useMessageMutations';
import {
  useCreateReminder,
  useDeleteReminder,
  useUpdateReminder,
} from '@/hooks/mutations/useReminderMutations';
import { useBundles } from '@/hooks/queries/useBundles';
import { useFollowUp } from '@/hooks/queries/useFollowUp';
import { useMailboxes } from '@/hooks/queries/useMailboxes';
import {
  useNeedsResponse,
  type NeedsResponseReason,
} from '@/hooks/queries/useNeedsResponse';
import { useReminders } from '@/hooks/queries/useReminders';
import { useBatchSentimentAnalysis } from '@/hooks/queries/useSentimentAnalysis';
import { useEmailStore } from '@/hooks/useEmail';
import { useInboxDisplayPrefs } from '@/hooks/useInboxDisplayPrefs';
import { useMessageActions } from '@/hooks/useMessageActions';
import { useLeaveRemovedRows } from '@/hooks/useLeaveRemovedRows';
import { calendarDaysBetween } from '@/utils/calendarDays';
import { useTranslation, type TranslateFn } from '@/lib/i18n';
import type {
  Bundle,
  Message,
  Reminder,
  UnreadableMessage,
} from '@/services/emailApi';
import { messageRoute } from '@/utils/messageRoute';
import { useCurrentList } from '@/hooks/useCurrentList';
import { AliaChatSheet, type AliaChatSheetRef } from '@alia.onl/sdk';
import { VoiceSession } from '@alia.onl/sdk/voice';

type ListItem =
  | { type: 'header'; title: string; key: string; count?: number }
  | {
      type: 'triage-header';
      title: string;
      description: string;
      key: string;
      count: number;
    }
  | {
      type: 'triage-message';
      data: Message;
      category: TriageCategory;
      reason: TriageReason;
    }
  | { type: 'message'; data: Message }
  | { type: 'bundle'; bundle: Bundle; messages: Message[]; unreadCount: number }
  | { type: 'reminder'; data: Reminder }
  | { type: 'unreadable'; data: UnreadableMessage; key: string };

type TriageCategory = 'needs-response' | 'follow-up';
type TriageReason = NeedsResponseReason | 'awaiting-reply';

/** FlashList wrapped once so Bloom's scroll worklet stays on the UI thread. */
const AnimatedInboxList = Animated.createAnimatedComponent(
  FlashList as React.ComponentType<
    FlashListProps<ListItem> & React.RefAttributes<FlashListRef<ListItem>>
  >,
) as React.ComponentType<
  AnimatedProps<FlashListProps<ListItem>> &
    React.RefAttributes<FlashListRef<ListItem>>
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
function pushGroup(
  items: ListItem[],
  title: string,
  key: string,
  messages: Message[],
): void {
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

const TRIAGE_LIMIT = 3;

export function InboxList({ replaceNavigation }: InboxListProps) {
  const router = useRouter();
  const shell = useAppShell();
  const occupiedBottom = useBottomEdgeInset();
  const { width: viewportWidth } = useWindowDimensions();
  const bottomClearance = viewportWidth < BREAKPOINTS.md ? occupiedBottom : 0;
  const drawerAvailable = shell.drawerAvailable;
  const colors = useColors();
  const { t } = useTranslation();
  const aliaChatRef = useRef<AliaChatSheetRef>(null);
  const aliaWelcomeSuggestions = useMemo(
    () => [
      {
        id: 'unread',
        title: t('inbox.aliaSuggestions.unread.label'),
        description: t('inbox.aliaSuggestions.unread.prompt'),
      },
      {
        id: 'today-summary',
        title: t('inbox.aliaSuggestions.todaysSummary.label'),
        description: t('inbox.aliaSuggestions.todaysSummary.prompt'),
      },
      {
        id: 'with-attachments',
        title: t('inbox.aliaSuggestions.withAttachments.label'),
        description: t('inbox.aliaSuggestions.withAttachments.prompt'),
      },
    ],
    [t],
  );
  const { isAuthenticated, user } = useOxy();
  const { prefs } = useInboxPrefs();
  const { density, showPreviews } =
    useInboxDisplayPrefs();
  const messageActions = useMessageActions();

  const currentMailbox = useEmailStore((s) => s.currentMailbox);
  const viewMode = useEmailStore((s) => s.viewMode);
  const selectedMessageId = useEmailStore((s) => s.selectedMessageId);
  const isSelectionMode = useEmailStore((s) => s.isSelectionMode);
  const selectedMessageIds = useEmailStore((s) => s.selectedMessageIds);
  const toggleMessageSelection = useEmailStore((s) => s.toggleMessageSelection);
  const enterSelectionMode = useEmailStore((s) => s.enterSelectionMode);
  const clearSelection = useEmailStore((s) => s.clearSelection);

  const {
    data: mailboxes = [],
    isError: mailboxesFailed,
    refetch: refetchMailboxes,
  } = useMailboxes();

  const {
    query: {
      isLoading,
      isError,
      isFetchingNextPage,
      refetch,
      fetchNextPage,
      hasNextPage,
    },
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
  const { data: bundles = [] } = useBundles();

  const [snoozeTargetId, setSnoozeTargetId] = useState<string | null>(null);
  const [createReminderVisible, setCreateReminderVisible] = useState(false);
  const [editReminderTarget, setEditReminderTarget] = useState<Reminder | null>(
    null,
  );

  const { data: remindersResult } = useReminders();
  const reminders = useMemo(
    () => remindersResult?.data ?? [],
    [remindersResult],
  );
  const createReminderMutation = useCreateReminder();
  const updateReminderMutation = useUpdateReminder();
  const deleteReminderMutation = useDeleteReminder();

  const isInboxView =
    viewMode?.type === 'mailbox'
      ? viewMode.mailbox.specialUse === SPECIAL_USE.INBOX
      : // No view chosen yet: the list falls back to the Inbox (useCurrentList).
        !viewMode &&
        (currentMailbox ? currentMailbox.specialUse === SPECIAL_USE.INBOX : true);
  const isSnoozedView =
    viewMode?.type === 'mailbox'
      ? viewMode.mailbox.specialUse === SPECIAL_USE.SNOOZED
      : !viewMode && currentMailbox?.specialUse === SPECIAL_USE.SNOOZED;
  const showBundles = bundleView && isInboxView && bundles.length > 0;

  const {
    messages: needsResponseMessages,
    count: needsResponseCount,
    reasons: needsResponseReasons,
  } = useNeedsResponse(isInboxView ? displayMessages : undefined, TRIAGE_LIMIT);
  const {
    messages: followUpMessages,
    count: followUpCount,
    isLoading: isFollowUpLoading,
  } = useFollowUp(isInboxView ? displayMessages : undefined, TRIAGE_LIMIT, {
    enabled: isInboxView,
  });

  /**
   * A row and everything it stands for. The triage sections show messages the
   * list does not hold — a follow-up is a message in Sent — and acting on one
   * found nothing to act on: every button and swipe on it did nothing.
   */
  const triageRow = useCallback(
    (rowId: string) =>
      followUpMessages.find((m) => m._id === rowId) ??
      needsResponseMessages.find((m) => m._id === rowId),
    [followUpMessages, needsResponseMessages],
  );
  const conversationOf = useCallback(
    (rowId: string): Message[] => {
      const members = listConversationOf(rowId);
      if (members.length > 0) return members;
      const row = triageRow(rowId);
      return row ? [row] : [];
    },
    [listConversationOf, triageRow],
  );

  // Sentiment is an inexpensive local heuristic, and is additionally gated by
  // the existing user-facing categorization preference. It is not an AI call.
  const sentimentMap = useBatchSentimentAnalysis(
    displayMessages,
    prefs.aiCategorization,
  );

  const [showTriage, setShowTriage] = useState(false);
  const [showBrief, setShowBrief] = useState(false);
  const triageItems = useMemo<ListItem[]>(() => {
    if (!isInboxView || !showTriage) return [];

    const items: ListItem[] = [];
    if (needsResponseMessages.length > 0) {
      items.push({
        type: 'triage-header',
        title: t('home.needsResponse'),
        description: t('home.needsResponse'),
        key: 'triage-needs-response-header',
        count: needsResponseCount,
      });
      for (const message of needsResponseMessages) {
        const reason = needsResponseReasons.get(message._id);
        if (reason) {
          items.push({
            type: 'triage-message',
            data: message,
            category: 'needs-response',
            reason,
          });
        }
      }
    }

    if (!isSelectionMode && !isFollowUpLoading && followUpMessages.length > 0) {
      items.push({
        type: 'triage-header',
        title: t('home.followUp'),
        description: t('home.followUp'),
        key: 'triage-follow-up-header',
        count: followUpCount,
      });
      for (const message of followUpMessages) {
        items.push({
          type: 'triage-message',
          data: message,
          category: 'follow-up',
          reason: 'awaiting-reply',
        });
      }
    }

    return items;
  }, [
    showTriage,
    followUpCount,
    followUpMessages,
    isFollowUpLoading,
    isInboxView,
    isSelectionMode,
    needsResponseCount,
    needsResponseMessages,
    needsResponseReasons,
    t,
  ]);

  const triageMessageIds = useMemo(
    () =>
      new Set(
        triageItems
          .filter(
            (item): item is Extract<ListItem, { type: 'triage-message' }> =>
              item.type === 'triage-message',
          )
          .map((item) => item.data._id),
      ),
    [triageItems],
  );

  const listItems = useMemo<ListItem[]>(() => {
    if (
      displayMessages.length === 0 &&
      reminders.length === 0 &&
      triageItems.length === 0 &&
      unreadable.length === 0
    ) {
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
        (r) => !r.completed && new Date(r.remindAt) <= new Date(),
      );
      const upcomingReminders = reminders.filter(
        (r) => !r.completed && new Date(r.remindAt) > new Date(),
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

    // Action candidates are shown once at the top with an explanation. Remove
    // those same rows from the date/pinned sections below to avoid duplication.
    items.push(...triageItems);

    // Partition pinned messages to top (only in mailbox views, not snoozed)
    const triagedMessages = displayMessages.filter(
      (message) => !triageMessageIds.has(message._id),
    );
    const pinned = !isSnoozedView
      ? triagedMessages.filter((m) => m.flags.pinned)
      : [];
    const unpinned = !isSnoozedView
      ? triagedMessages.filter((m) => !m.flags.pinned)
      : triagedMessages;

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
    reminders,
    showBundles,
    t,
    triageItems,
    triageMessageIds,
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
  useEffect(() => {
    clearSelection();
  }, [viewKey, clearSelection]);

  // The spinner is the pull's, not every refetch's: background polls, socket
  // events and mutations refetch too, and the spinner popped up for each.
  const [pulling, setPulling] = useState(false);
  const handleRefresh = useCallback(() => {
    setPulling(true);
    void refetch().finally(() => setPulling(false));
  }, [refetch]);

  const handleLoadMore = useCallback(() => {
    if (isFetchingNextPage || !hasNextPage) return;
    fetchNextPage();
  }, [fetchNextPage, isFetchingNextPage, hasNextPage]);

  // Pin state is the conversation's, as the row shows it: unpinning unpins
  // every pinned message in it, pinning pins the row's own message.
  const handlePin = useCallback(
    (rowId: string) => {
      if (togglePin.isPending) return;
      const row = displayMessages.find((m) => m._id === rowId) ?? triageRow(rowId);
      if (!row) return;
      if (row.flags.pinned) {
        for (const m of conversationOf(rowId)) {
          if (m.flags.pinned) togglePin.mutate({ messageId: m._id, pinned: false });
        }
      } else {
        togglePin.mutate({ messageId: rowId, pinned: true });
      }
    },
    [displayMessages, conversationOf, togglePin, triageRow],
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
    [snoozeTargetId, conversationOf, messageActions, removing],
  );

  const handleCreateReminder = useCallback(
    (text: string, remindAt: Date) => {
      createReminderMutation.mutate({ text, remindAt: remindAt.toISOString() });
      setCreateReminderVisible(false);
    },
    [createReminderMutation],
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
    [reminders, router, replaceNavigation],
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
    [editReminderTarget, updateReminderMutation],
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
  // an unreadable row by definition is not.
  const handleOpenUnreadable = useCallback(
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
    aliaChatRef.current?.present();
  }, []);

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
    if (currentMailbox?.specialUse === SPECIAL_USE.INBOX)
      return t('drawer.mailboxes.Inbox');
    if (currentMailbox?.specialUse === SPECIAL_USE.SENT)
      return t('drawer.mailboxes.Sent');
    if (currentMailbox?.specialUse === SPECIAL_USE.DRAFTS)
      return t('drawer.mailboxes.Drafts');
    if (currentMailbox?.specialUse === SPECIAL_USE.TRASH)
      return t('drawer.mailboxes.Trash');
    if (currentMailbox?.specialUse === SPECIAL_USE.SPAM)
      return t('drawer.mailboxes.Spam');
    if (currentMailbox?.specialUse === SPECIAL_USE.ARCHIVE)
      return t('drawer.mailboxes.Archive');
    if (currentMailbox?.specialUse === SPECIAL_USE.SNOOZED)
      return t('drawer.mailboxes.Snoozed');
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
    [handleArchiveRow, handleDeleteRow, handleToggleRead],
  );

  /** One message row, shared by the flat items and the grouped panels. */
  const pinPendingId =
    togglePin.isPending && togglePin.variables?.messageId
      ? togglePin.variables.messageId
      : null;

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
      colors.primary,
      colors.border,
    ],
  );

  const renderMessageRow = useCallback(
    (msg: Message) => (
      <SwipeableRow
        key={msg._id}
        messageId={msg._id}
        leftAction={prefs.leftSwipeAction}
        rightAction={prefs.rightSwipeAction}
        onAction={handleSwipeAction}
      >
        <MessageRow
          message={msg}
          onPin={handlePin}
          onSelect={handleMessagePress}
          onArchive={handleArchiveRow}
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
        />
        <MessageRowExtras message={msg} sentiment={sentimentMap.get(msg._id)} />
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
    ],
  );

  const renderTriageMessage = useCallback(
    (item: Extract<ListItem, { type: 'triage-message' }>) => {
      const reasonLabel =
        item.category === 'follow-up'
          ? t('home.followUp')
          : item.reason === 'question'
            ? t('home.needsResponse')
            : item.reason === 'waiting'
              ? t('home.needsResponse')
              : t('home.needsResponse');

      return (
        <View style={styles.triageMessageItem}>
          <Text style={[styles.triageReason, { color: colors.secondaryText }]}>
            {reasonLabel}
          </Text>
          {renderMessageRow(item.data)}
        </View>
      );
    },
    [colors.secondaryText, renderMessageRow, t],
  );

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.type === 'header') {
        return (
          <View style={styles.sectionHeader} accessibilityRole="header">
            <Text
              style={[
                styles.sectionHeaderText,
                { color: colors.secondaryText },
              ]}
            >
              {item.title}
            </Text>
            {item.count !== undefined ? (
              <Text
                style={[
                  styles.sectionHeaderCount,
                  { color: colors.secondaryText },
                ]}
              >
                {item.count}
              </Text>
            ) : null}
          </View>
        );
      }
      if (item.type === 'triage-header') {
        return (
          <View style={styles.triageHeader} accessibilityRole="header">
            <View style={styles.triageHeaderText}>
              <Text
                style={[styles.sectionHeaderText, { color: colors.primary }]}
              >
                {item.title}
              </Text>
              <Text
                style={[
                  styles.triageDescription,
                  { color: colors.secondaryText },
                ]}
              >
                {item.description}
              </Text>
            </View>
            <Text
              style={[
                styles.sectionHeaderCount,
                { color: colors.secondaryText },
              ]}
            >
              {item.count}
            </Text>
          </View>
        );
      }
      if (item.type === 'triage-message') return renderTriageMessage(item);
      if (item.type === 'unreadable') {
        return (
          <View style={styles.messageItem}>
            <UnreadableMessageRow
              message={item.data}
              onOpen={handleOpenUnreadable}
            />
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
      return (
        <View style={styles.messageItem}>{renderMessageRow(item.data)}</View>
      );
    },
    // Only what this function itself reads. It used to re-list
    // `renderMessageRow`'s own dependencies by hand while omitting
    // `renderMessageRow` — so the copy had to be kept in sync manually, and
    // every row kept whichever callbacks it closed over when the copy last
    // happened to change.
    [
      colors.primary,
      colors.secondaryText,
      expandedBundles,
      handleDeleteReminder,
      handleOpenUnreadable,
      handleReminderPress,
      handleToggleReminderComplete,
      renderMessageRow,
      renderTriageMessage,
      toggleBundle,
    ],
  );

  const getItemType = useCallback((item: ListItem) => item.type, []);

  const keyExtractor = useCallback((item: ListItem) => {
    if (item.type === 'header') return item.key;
    if (item.type === 'triage-header') return item.key;
    if (item.type === 'triage-message')
      return `triage-${item.category}-${item.data._id}`;
    if (item.type === 'bundle') return `bundle-${item.bundle._id}`;
    if (item.type === 'reminder') return `reminder-${item.data._id}`;
    if (item.type === 'unreadable') return item.key;
    return item.data._id;
  }, []);

  const listRef = useRef<FlashListRef<ListItem>>(null);
  const onListScroll = useMailboxScrollRestoration(
    listRef,
    JSON.stringify(['mailbox', user?.id, messagesOptions]),
    listItems.length > 0,
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
        description={
          isAuthenticated ? t('inbox.emptyAllCaught') : t('inbox.emptySignIn')
        }
        footer={
          !isAuthenticated ? <OxySignInButton variant="contained" /> : undefined
        }
      />
    );
  }, [isAuthenticated, isLoading, isError, listReady, mailboxesFailed, refetch, refetchMailboxes, t]);

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footer}>
        <Loading variant="inline" size="sm" />
      </View>
    );
  }, [isFetchingNextPage]);

  return (
    <View style={styles.container}>
      {isSelectionMode ? (
        <SelectionToolbar
          count={selectedMessageIds.size}
          onClose={clearSelection}
          onArchive={handleBulkArchive}
          onDelete={handleBulkDelete}
          onStar={handleBulkStar}
          onMarkRead={handleBulkMarkRead}
        />
      ) : (
        // The shared header stays in flow above the virtualized message list.
        <View>
          <PageHeader
            title={mailboxTitle}
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
                {isAuthenticated && (
                  <>
                    <ButtonGroupItem
                      iconOnly
                      leadingIcon={RiAddLine}
                      accessibilityLabel={t('reminder.create.title')}
                      onPress={() => setCreateReminderVisible(true)}
                    />
                    <ButtonGroupItem onPress={handleAskAlia}>
                      {t('inbox.askAlia')}
                    </ButtonGroupItem>
                  </>
                )}
                <ButtonGroupItem
                  iconOnly
                  leadingIcon={RiSearchLine}
                  accessibilityLabel={t('inbox.searchInMailbox', {
                    mailbox: mailboxTitle.toLowerCase(),
                  })}
                  onPress={handleSearch}
                />
              </ButtonGroup>
            }
          />
          {isAuthenticated &&
            (prefs.aiBrief ||
              (isInboxView && needsResponseCount + followUpCount > 0)) && (
              <View className="flex-row flex-wrap gap-1 px-3 pb-2">
                {isInboxView && needsResponseCount + followUpCount > 0 && (
                  <Button
                    appearance={showTriage ? 'solid' : 'subtle'}
                    onPress={() => setShowTriage((value) => !value)}
                  >{`${t('home.needsResponse')} · ${needsResponseCount + followUpCount}`}</Button>
                )}
                {prefs.aiBrief && (
                  <Button
                    appearance="subtle"
                    onPress={() => setShowBrief((value) => !value)}
                  >
                    {t('home.todaysBrief')}
                  </Button>
                )}
              </View>
            )}
        </View>
      )}

      {isLoading && messages.length === 0 ? (
        <View style={styles.loadingContainer}>
          <Loading />
        </View>
      ) : (
        <View style={styles.listContainer}>
          <AnimatedInboxList
            ref={listRef}
            data={listItems}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            getItemType={getItemType}
            ListHeaderComponent={
              <>
                <OutboundQueueBanner />
                {showBrief && <InboxGreeting messages={displayMessages} />}
              </>
            }
            ListEmptyComponent={renderEmpty}
            ListFooterComponent={renderFooter}
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
              paddingBottom: bottomClearance,
            }}
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}

      {/* Alia remains available from the inline header action. */}
      {isAuthenticated && (
        <AliaChatSheet
          ref={aliaChatRef}
          voiceSession={VoiceSession}
          clientContext={t('inbox.aliaClientContext')}
          welcomeSuggestions={aliaWelcomeSuggestions}
        />
      )}

      {/* Snooze sheet */}
      <SnoozeSheet
        visible={snoozeTargetId !== null}
        onClose={() => setSnoozeTargetId(null)}
        onSnooze={handleSnooze}
      />

      {/* Create reminder sheet */}
      <CreateReminderSheet
        visible={createReminderVisible}
        onClose={() => setCreateReminderVisible(false)}
        onCreate={handleCreateReminder}
      />

      {/* Edit reminder sheet (opened by tapping a standalone reminder) */}
      <CreateReminderSheet
        visible={editReminderTarget !== null}
        editReminder={editReminderTarget}
        onClose={() => setEditReminderTarget(null)}
        onCreate={handleCreateReminder}
        onUpdate={handleUpdateReminder}
      />
    </View>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyListContent: {
    flexGrow: 1,
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
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
  triageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginHorizontal: SPACING.md,
    paddingHorizontal: SPACING.xs,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  triageHeaderText: {
    flex: 1,
    gap: SPACING.xs,
  },
  triageDescription: {
    fontSize: 12,
    lineHeight: 17,
  },
  triageMessageItem: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
  },
  triageReason: {
    fontSize: 11,
    lineHeight: 16,
    marginHorizontal: SPACING.sm,
    marginBottom: SPACING.xs,
  },
});
