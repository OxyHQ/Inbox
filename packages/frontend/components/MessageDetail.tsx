import { tokens } from '@oxy.so/bloom/styles';
import { Screen, ScreenScrollView } from '@oxy.so/bloom/screen';
import { useTheme } from '@oxy.so/bloom/theme';
import { PageFooter } from '@oxy.so/bloom/page-footer';
import { Card, CardBody } from '@oxy.so/bloom/card';
import { EmptyState } from '@oxy.so/bloom/empty-state';
import { EmptyStateSticker } from '@/components/EmptyStateSticker';
import { Text } from '@oxy.so/bloom/typography';
import { useAppShell } from '@oxy.so/bloom/app-shell';
import { ButtonGroup, ButtonGroupItem } from '@oxy.so/bloom/button-group';
import { Button, IconButton } from '@oxy.so/bloom/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@oxy.so/bloom/dropdown-menu';
import { RiArchiveLine } from '@oxy.so/bloom/icons/RiArchiveLine';
import { RiCalendarLine } from '@oxy.so/bloom/icons/RiCalendarLine';
import { RiInbox2Line } from '@oxy.so/bloom/icons/RiInbox2Line';
import { RiArrowGoBackLine } from '@oxy.so/bloom/icons/RiArrowGoBackLine';
import { RiCornerUpLeftLine } from '@oxy.so/bloom/icons/RiCornerUpLeftLine';
import { RiDeleteBinLine } from '@oxy.so/bloom/icons/RiDeleteBinLine';
import { RiDraftLine } from '@oxy.so/bloom/icons/RiDraftLine';
import { RiFolderLine } from '@oxy.so/bloom/icons/RiFolderLine';
import { RiPriceTag3Line } from '@oxy.so/bloom/icons/RiPriceTag3Line';
import { RiSpamLine } from '@oxy.so/bloom/icons/RiSpamLine';
import { RiMailLine } from '@oxy.so/bloom/icons/RiMailLine';
import { RiMenuLine } from '@oxy.so/bloom/icons/RiMenuLine';
import { RiMoreLine } from '@oxy.so/bloom/icons/RiMoreLine';
import { RiPrinterLine } from '@oxy.so/bloom/icons/RiPrinterLine';
import { RiPushpinLine } from '@oxy.so/bloom/icons/RiPushpinLine';
import { RiShareForwardLine } from '@oxy.so/bloom/icons/RiShareForwardLine';
import { RiStarFill } from '@oxy.so/bloom/icons/RiStarFill';
import { RiStarLine } from '@oxy.so/bloom/icons/RiStarLine';
import { RiTimeLine } from '@oxy.so/bloom/icons/RiTimeLine';
import { MailMessage, MailThread, type MailThreadMessage } from '@oxy.so/bloom/mail-thread';
import { PageHeader } from '@oxy.so/bloom/page-header';
/**
 * Reusable message detail view.
 *
 * Supports two modes:
 * - standalone: full-screen route with back button (mobile)
 * - embedded: inline panel without back button (desktop split-view)
 */

import { toast } from '@oxy.so/bloom/toast';
import { Loading } from '@oxy.so/bloom/loading';
import { useOxy } from '@oxy.so/services/ui/client';
import * as Print from 'expo-print';
import { useIsFocused, usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { CreateReminderSheet } from '@/components/CreateReminderSheet';
import { useCreateReminder } from '@/hooks/mutations/useReminderMutations';
import { isCurrentEmailOwner, useEmailMutationOwner } from '@/hooks/mutations/ownedEmailMutation';
import { HtmlBody } from '@/components/HtmlBody';
import { InlineReply } from '@/components/InlineReply';
import { SnoozeSheet } from '@/components/SnoozeSheet';
import { StaleThreadBanner } from '@/components/StaleThreadBanner';
import { DeliveryNotice, useDeliveryLabel } from '@/components/DeliveryStatus';
import { isOutstanding } from '@/utils/delivery';
import { ThreadOverview } from '@/components/ThreadOverview';
import { UnreadableThreadEntry } from '@/components/UnreadableThreadEntry';
import { CardRenderer } from '@/components/cards/CardRenderer';
import { SPECIAL_USE } from '@/constants/mailbox';
import { useColors } from '@/constants/theme';
import {
  useTogglePin,
  useToggleStar,
  useUpdateMessageLabels,
} from '@/hooks/mutations/useMessageMutations';
import { useInboxPrefs } from '@/contexts/inbox-prefs-context';
import { useMessageActions } from '@/hooks/useMessageActions';
import { useLabels } from '@/hooks/queries/useLabels';
import { useMailboxes } from '@/hooks/queries/useMailboxes';
import { useMessage } from '@/hooks/queries/useMessage';
import { useSentimentAnalysis } from '@/hooks/queries/useSentimentAnalysis';
import { useStaleThread } from '@/hooks/queries/useStaleThread';
import { useThread } from '@/hooks/queries/useThread';
import { useCidResolver } from '@/hooks/useCidResolver';
import { useEmailStore } from '@/hooks/useEmail';
import { useGoBack } from '@/hooks/useGoBack';
import { useLeaveOpenConversation } from '@/hooks/useLeaveRemovedRows';
import { useTranslation } from '@/lib/i18n';
import { type Message, UnreadableMessageError } from '@/services/emailApi';
import { messageRoute } from '@/utils/messageRoute';
import { toRfcMessageId } from '@/utils/replyHeaders';
import { buildPrintHtml, printHtmlOnWeb } from '@/utils/printMessage';
import { useOpenAttachment } from '@/hooks/useOpenAttachment';
import { emlFilename, saveEmlFile } from '@/utils/saveEml';
import { buildThreadEntries } from '@/utils/threadEntries';
import { splitHtmlQuote, splitTextQuote } from '@/utils/messageQuotes';

function formatFullDate(dateStr: string, locale: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatShortDate(dateStr: string, locale: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isThisYear = date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString(locale, {
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  if (isThisYear) {
    return date.toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
    });
  }
  return date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** A message's own text and the quote under it, with its inline images resolved. */
function messagePartsOf(message: Message, resolvedHtml: Record<string, string>) {
  return message.html
    ? splitHtmlQuote(resolvedHtml[message._id] ?? message.html)
    : splitTextQuote(message.text ?? '');
}

function getSnippet(text: string | null | undefined, maxLength = 100): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength)}...` : clean;
}

interface MessageDetailProps {
  mode: 'standalone' | 'embedded';
  messageId: string;
}

/**
 * Public wrapper — uses `messageId` as a React key so the inner component
 * unmounts/remounts on message change, naturally resetting all local state
 * (no manual reset effect required).
 */
export function MessageDetail(props: MessageDetailProps) {
  return <MessageDetailInner key={props.messageId} {...props} />;
}

function MessageDetailInner({ mode, messageId }: MessageDetailProps) {
  const shell = useAppShell();
  const focused = useIsFocused();
  const { colors: bloomColors } = useTheme();
  const pathname = usePathname();
  const colors = useColors();
  const { t, locale } = useTranslation();
  const deliveryLabel = useDeliveryLabel();

  const { data: currentMessage, isLoading, isError, error, refetch } = useMessage(messageId);
  const {
    data: threadData,
    refetch: refetchThread,
    isPending: threadLoading,
  } = useThread(messageId);
  const threadMessages = useMemo(() => threadData?.messages ?? [], [threadData]);
  const threadUnreadable = useMemo(() => threadData?.unreadable ?? [], [threadData]);
  const sortedThread = useMemo(() => {
    if (threadMessages.length === 0) return currentMessage ? [currentMessage] : [];
    return [...threadMessages].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  }, [threadMessages, currentMessage]);

  // What Archive, Delete, Spam and Snooze act on: the conversation's messages
  // in the opened message's folder. Not the replies the user sent (they live in
  // Sent) and not unsent drafts. It used to be the opened message alone, so
  // archiving a conversation left the rest of it in the Inbox.
  const folderConversation = useMemo(() => {
    if (!currentMessage) return [];
    const members = sortedThread.filter(
      (m) => m.mailboxId === currentMessage.mailboxId && !m.flags.draft,
    );
    return members.some((m) => m._id === currentMessage._id)
      ? members
      : [...members, currentMessage];
  }, [sortedThread, currentMessage]);

  const emailApi = useEmailStore((s) => s._api);
  const { data: mailboxes = [] } = useMailboxes();
  const { data: labels = [] } = useLabels();
  const toggleStar = useToggleStar();
  const messageActions = useMessageActions();
  const { prefs } = useInboxPrefs();
  const updateLabels = useUpdateMessageLabels();
  const togglePin = useTogglePin();

  const createReminder = useCreateReminder();
  const reminderOwner = useEmailMutationOwner(true);
  const reminderEditorId = useRef(0);
  const [reminderTarget, setReminderTarget] = useState<{
    id: string;
    key: number;
    owner: typeof reminderOwner;
    mutate: typeof createReminder.mutateAsync;
  } | null>(null);
  const handleCreateReminder = useCallback(
    async (text: string, remindAt: Date) => {
      const target = reminderTarget;
      if (!target || !isCurrentEmailOwner(target.owner))
        throw new Error('Reminder session changed');
      await target.mutate({ text, remindAt: remindAt.toISOString(), relatedMessageId: target.id });
      setReminderTarget((current) => (current === target ? null : current));
    },
    [reminderTarget],
  );

  const [snoozeVisible, setSnoozeVisible] = useState(false);
  const [replyMode, setReplyMode] = useState<'reply' | 'reply-all' | 'forward' | null>(null);
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set([messageId]));

  // Sentiment analysis for the current message
  const sentiment = useSentimentAnalysis(currentMessage);

  // Get current user for stale thread detection
  const { user, oxyServices } = useOxy();

  // Reading a conversation marks it read — here, once per conversation opened,
  // whatever opened it. It used to be the list tap, which marked only the row's
  // own message, and nothing at all for a search result or a notification.
  const markedReadFor = useRef<string | null>(null);
  useEffect(() => {
    if (!prefs.markReadOnOpen || !currentMessage || markedReadFor.current === messageId) return;
    // Wait for the conversation, or only the opened message would be marked.
    if (threadLoading) return;
    markedReadFor.current = messageId;
    messageActions.setRead(sortedThread, true, { quiet: true });
  }, [
    prefs.markReadOnOpen,
    currentMessage,
    messageId,
    threadLoading,
    sortedThread,
    messageActions,
  ]);

  const backFallback = pathname.startsWith('/search') ? '/search' : '/';
  const handleBack = useGoBack(backFallback);
  // Archive, Delete, Spam and Snooze take the conversation out of its folder.
  const leaveOpenConversation = useLeaveOpenConversation(mode);
  const leaveConversation = useCallback(
    () => leaveOpenConversation(folderConversation.map((m) => m._id)),
    [leaveOpenConversation, folderConversation],
  );

  const handleStar = useCallback(() => {
    if (!messageId || !currentMessage || toggleStar.isPending) return;
    toggleStar.mutate({ messageId, starred: !currentMessage.flags.starred });
  }, [messageId, currentMessage, toggleStar]);

  const handlePin = useCallback(() => {
    if (!messageId || !currentMessage || togglePin.isPending) return;
    togglePin.mutate({ messageId, pinned: !currentMessage.flags.pinned });
  }, [messageId, currentMessage, togglePin]);

  const handleSnooze = useCallback(
    (until: Date) => {
      if (!messageId) return;
      setSnoozeVisible(false);
      leaveConversation();
      messageActions.snooze(folderConversation, until.toISOString());
    },
    [messageId, messageActions, folderConversation, leaveConversation],
  );

  // In Archive the button moves the conversation back to the Inbox.
  const archived = messageActions.isArchived(folderConversation);
  const handleArchive = useCallback(() => {
    if (!messageId) return;
    if (!mailboxes.some((m) => m.specialUse === SPECIAL_USE.ARCHIVE)) {
      toast.error(t('inbox.toast.archiveUnavailable'));
      return;
    }
    leaveConversation();
    messageActions.archive(folderConversation);
  }, [messageId, mailboxes, messageActions, folderConversation, leaveConversation, t]);

  const handleDelete = useCallback(() => {
    if (!messageId) return;
    // Permanently or to Trash is decided per message from where it IS (see
    // useMessageActions). It was decided from the folder last browsed: opened
    // from a notification after visiting Trash, an Inbox message was destroyed.
    leaveConversation();
    messageActions.deleteConversation(folderConversation);
  }, [messageId, messageActions, folderConversation, leaveConversation]);

  const handleMarkUnread = useCallback(() => {
    if (!currentMessage) return;
    messageActions.setRead([currentMessage], false);
    if (mode === 'standalone') handleBack();
  }, [currentMessage, messageActions, handleBack, mode]);

  const handleMarkSpam = useCallback(() => {
    if (!messageId) return;
    const spamBox = mailboxes.find((m) => m.specialUse === SPECIAL_USE.SPAM);
    if (!spamBox) {
      toast.error(t('message.toast.spamUnavailable'));
      return;
    }
    leaveConversation();
    messageActions.moveTo(folderConversation, spamBox._id, 'spam');
  }, [messageId, mailboxes, messageActions, folderConversation, leaveConversation, t]);

  const handleMoveToFolder = useCallback(
    (mailboxId: string) => {
      leaveConversation();
      messageActions.moveTo(folderConversation, mailboxId);
    },
    [leaveConversation, messageActions, folderConversation],
  );

  const router = useRouter();

  /**
   * Reply or reply all. A reply to this message that is already saved as a
   * draft is reopened in the composer: starting a fresh one beside it left two
   * drafts of the same reply, and sending one kept the other in Drafts.
   */
  const openReply = useCallback(
    (mode: 'reply' | 'reply-all', targetMsgId?: string) => {
      if (!currentMessage) return;
      const target =
        (targetMsgId ? sortedThread.find((m) => m._id === targetMsgId) : undefined) ??
        (currentMessage.flags.draft
          ? [...sortedThread].reverse().find((m) => !m.flags.draft)
          : currentMessage);
      const parentId = toRfcMessageId(target?.messageId);
      const existing = parentId
        ? [...sortedThread]
            .reverse()
            .find((m) => m.flags.draft && toRfcMessageId(m.inReplyTo) === parentId)
        : undefined;
      if (existing) {
        router.push(messageRoute(existing));
        return;
      }
      setReplyTargetId(targetMsgId || null);
      setReplyMode(mode);
    },
    [currentMessage, router, sortedThread],
  );
  const handleReply = useCallback(
    (targetMsgId?: string) => openReply('reply', targetMsgId),
    [openReply],
  );
  const handleReplyAll = useCallback(
    (targetMsgId?: string) => openReply('reply-all', targetMsgId),
    [openReply],
  );

  const handleForward = useCallback(
    (targetMsgId?: string) => {
      if (!currentMessage) return;
      setReplyTargetId(targetMsgId || null);
      setReplyMode('forward');
    },
    [currentMessage],
  );

  const handleCloseReply = useCallback(() => {
    setReplyMode(null);
    setReplyTargetId(null);
  }, []);

  const toggleMessageExpanded = useCallback((msgId: string) => {
    setExpandedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  }, []);

  // Sort thread messages by date (oldest first for conversation view)

  // A reply answers the newest message that was actually sent or received —
  // never one of the user's own unsent drafts, which is what the footer's
  // Reply used to do when the opened message was a draft.
  const replyableMessage = useMemo(
    () =>
      [...sortedThread].reverse().find((m) => !m.flags.draft) ??
      (currentMessage && !currentMessage.flags.draft ? currentMessage : null),
    [sortedThread, currentMessage],
  );
  // The newest unsent draft in this conversation, finished in the composer.
  const threadDraft = useMemo(
    () => [...sortedThread].reverse().find((m) => m.flags.draft) ?? null,
    [sortedThread],
  );
  const handleEditDraft = useCallback(
    (draft: Message) => router.push(messageRoute(draft)),
    [router],
  );

  // Every row of the conversation, the unreadable ones in their place.
  const threadEntries = useMemo(
    () => buildThreadEntries(sortedThread, threadUnreadable),
    [sortedThread, threadUnreadable],
  );

  /**
   * Save a message's source as `.eml`: the server's raw RFC 5322 export, with
   * its attachments and its original encodings. It is also how a message this
   * client could not read is opened.
   */
  const downloadSource = useCallback(
    async (sourceId: string, subject: string | null | undefined) => {
      if (!emailApi) return;
      try {
        const { content } = await emailApi.exportMessage(sourceId);
        await saveEmlFile(content, emlFilename(subject), t);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : t('message.toast.downloadFailed'));
      }
    },
    [emailApi, t],
  );

  const handleOpenRaw = useCallback(
    (rawMessageId: string) =>
      downloadSource(
        rawMessageId,
        threadUnreadable.find((entry) => entry._id === rawMessageId)?.subject,
      ),
    [downloadSource, threadUnreadable],
  );

  // Detect stale threads that need a response
  const staleInfo = useStaleThread(sortedThread, {
    username: user?.username,
    email: user?.email,
  });

  // Resolve CID inline image references to signed File Manager URLs
  const resolvedHtmlMap = useCidResolver(sortedThread, oxyServices, messageId);
  const messageParts = useMemo(
    () =>
      new Map(
        sortedThread.map((message) => [message._id, messagePartsOf(message, resolvedHtmlMap)]),
      ),
    [sortedThread, resolvedHtmlMap],
  );

  const handleAttachment = useOpenAttachment();

  const handleToggleLabel = useCallback(
    (labelName: string) => {
      if (!currentMessage) return;
      const hasLabel = currentMessage.labels.includes(labelName);
      updateLabels.mutate({
        messageId,
        add: hasLabel ? [] : [labelName],
        remove: hasLabel ? [labelName] : [],
      });
    },
    [currentMessage, messageId, updateLabels],
  );

  const handlePrint = useCallback(() => {
    if (!currentMessage) return;
    // The reader's HTML, inline (cid:) images resolved, not the raw body.
    const printHtml = buildPrintHtml(
      { ...currentMessage, html: resolvedHtmlMap[currentMessage._id] ?? currentMessage.html },
      {
        noSubject: t('message.detail.noSubject'),
        date: formatFullDate(currentMessage.date, locale),
        labels: {
          from: t('message.print.from'),
          to: t('message.print.to'),
          cc: t('message.print.cc'),
          date: t('message.print.date'),
        },
      },
    );

    if (Platform.OS === 'web') {
      printHtmlOnWeb(printHtml);
    } else {
      (async () => {
        try {
          await Print.printAsync({ html: printHtml });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : t('message.toast.printFailed');
          toast.error(message);
        }
      })();
    }
  }, [currentMessage, resolvedHtmlMap, locale, t]);

  // It used to assemble the file itself: bodies declared quoted-printable but
  // written raw (so every `=` in the HTML was decoded into garbage), no
  // attachments, and unencoded non-ASCII headers.
  const handleDownloadEml = useCallback(() => {
    if (!currentMessage) return;
    void downloadSource(currentMessage._id, currentMessage.subject);
  }, [currentMessage, downloadSource]);

  // Label data for assigned labels (backend stores label names, not IDs)
  const assignedLabels = useMemo(() => {
    if (!currentMessage) return [];
    return labels.filter((l) => currentMessage.labels.includes(l.name));
  }, [currentMessage, labels]);

  const standaloneToolbar =
    mode === 'standalone' ? (
      <PageHeader
        onBack={handleBack}
        backLabel={t('common.back')}
        sticky={false}
        scrim="none"
        safeArea={false}
      />
    ) : null;

  // Before the email API exists (it is created in an effect after sign-in) the
  // read has not even started: that is loading, not "message not found".
  if (isLoading || (!emailApi && !currentMessage)) {
    return (
      <Screen active={focused} scroll="none" header={standaloneToolbar}>
        <View style={styles.loadingContainer}>
          <Loading />
        </View>
      </Screen>
    );
  }

  // The message is there but this client cannot read it: the entry the
  // conversation shows for such a row, with its source to download. The load
  // error it used to show offered a retry that parsed the same row again.
  if (error instanceof UnreadableMessageError) {
    const row = error.unreadable;
    return (
      <View className="flex-1">
        {standaloneToolbar}
        <View className="flex-1 justify-center">
          <UnreadableThreadEntry
            row={{ ...row, _id: row._id ?? messageId }}
            onRetry={() => void refetch()}
            onOpenRaw={(id) => void downloadSource(id, row.subject)}
          />
        </View>
      </View>
    );
  }

  if (isError || !currentMessage) {
    return (
      <Screen active={focused} scroll="none" header={standaloneToolbar}>
        <EmptyState
          illustration={<EmptyStateSticker name={isError ? 'loadError' : 'notFound'} />}
          title={t(isError ? 'ui.message.loadError' : 'ui.message.notFound')}
          description={t(
            isError ? 'ui.message.loadErrorDescription' : 'ui.message.notFoundDescription',
          )}
          action={isError ? { label: t('common.retry'), onPress: () => void refetch() } : undefined}
        />
      </Screen>
    );
  }

  // No maxContentWidth - use full available width like Gmail

  const threadStrings = {
    to: t('compose.fields.to'),
    cc: t('compose.fields.cc'),
    bcc: t('compose.fields.bcc'),
    reply: t('message.actions.reply'),
    replyAll: t('message.actions.replyAll'),
    forward: t('message.actions.forward'),
  };
  const toThreadMessage = (msg: Message): MailThreadMessage => {
    const parts = messageParts.get(msg._id) ?? messagePartsOf(msg, resolvedHtmlMap);
    const renderBody = (content: string) =>
      msg.html ? <HtmlBody html={content} /> : <Text selectable>{content}</Text>;
    return {
      id: msg._id,
      sender: {
        ...msg.from,
        name: msg.from.name ?? undefined,
        avatar: msg.senderAvatarPath
          ? `${process.env.EXPO_PUBLIC_API_URL ?? 'https://api.oxy.so'}${msg.senderAvatarPath}`
          : undefined,
      },
      to: msg.to.map((address) => ({
        ...address,
        name: address.name ?? undefined,
      })),
      cc: msg.cc?.map((address) => ({
        ...address,
        name: address.name ?? undefined,
      })),
      date: formatFullDate(msg.date, locale),
      time: formatShortDate(msg.date, locale),
      preview: getSnippet(msg.text),
      unread: !msg.flags.seen,
      starred: msg.flags.starred,
      onStarredChange: (starred) => {
        if (!toggleStar.isPending) toggleStar.mutate({ messageId: msg._id, starred });
      },
      // A draft is the user's own unsent message: it is finished and sent,
      // not replied to or forwarded.
      ...(msg.flags.draft
        ? {}
        : {
            onReply: () => handleReply(msg._id),
            onReplyAll: () => handleReplyAll(msg._id),
            onForward: () => handleForward(msg._id),
          }),
      // An inline image is part of an HTML body, not a file the sender
      // attached. Without an HTML body it has nowhere else to appear.
      attachments: msg.attachments
        .filter((attachment) => !(msg.html && attachment.isInline && attachment.contentId))
        .map((attachment) => ({
          id: attachment.fileId,
          name: attachment.name,
          onPress: () => handleAttachment(attachment.fileId, attachment.name),
        })),
      menu: msg.flags.draft ? (
        <IconButton
          accessibilityLabel={t('message.actions.editDraft')}
          icon={<RiDraftLine />}
          onPress={() => handleEditDraft(msg)}
        />
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild label={t('message.actions.more')}>
            <IconButton accessibilityLabel={t('message.actions.more')} icon={<RiMoreLine />} />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem leading={<RiCornerUpLeftLine />} onPress={() => handleReply(msg._id)}>
              {t('message.actions.reply')}
            </DropdownMenuItem>
            <DropdownMenuItem
              leading={<RiArrowGoBackLine />}
              onPress={() => handleReplyAll(msg._id)}
            >
              {t('message.actions.replyAll')}
            </DropdownMenuItem>
            <DropdownMenuItem
              leading={<RiShareForwardLine />}
              onPress={() => handleForward(msg._id)}
            >
              {t('message.actions.forward')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      ...(msg.flags.draft ? { time: t('message.draftLabel') } : {}),
      // A sent message that has not left says so where its time would be, so
      // a collapsed conversation shows it too.
      ...(isOutstanding(msg.delivery) ? { time: deliveryLabel(msg.delivery) } : {}),
      children: (
        <>
          {/* Why it has not left, and what to do about it. */}
          <DeliveryNotice message={msg} />
          {parts.body.trim() ? (
            renderBody(parts.body)
          ) : parts.quoted ? null : (
            <Text>{t('message.detail.emptyMessage')}</Text>
          )}
          {msg.flags.draft && (
            <View style={{ alignItems: 'flex-start', marginTop: tokens.space.sm }}>
              <Button leadingIcon={RiDraftLine} onPress={() => handleEditDraft(msg)}>
                {t('message.actions.editDraft')}
              </Button>
            </View>
          )}
        </>
      ),
      trimmed: parts.quoted ? renderBody(parts.quoted) : undefined,
    };
  };

  return (
    <Screen
      active={focused}
      scroll="auto"
      testID="message-screen"
      header={
        <PageHeader
          onBack={handleBack}
          backLabel={t('common.back')}
          leading={
            <>
              {shell.drawerAvailable && (
                <ButtonGroup accessibilityLabel={t('search.openMenu')}>
                  <ButtonGroupItem
                    iconOnly
                    leadingIcon={RiMenuLine}
                    accessibilityLabel={t('search.openMenu')}
                    onPress={shell.openDrawer}
                  />
                </ButtonGroup>
              )}
              {replyableMessage && (
                <ButtonGroup>
                  <ButtonGroupItem
                    iconOnly
                    accessibilityLabel={t('message.actions.reply')}
                    leadingIcon={RiCornerUpLeftLine}
                    onPress={() => handleReply(replyableMessage._id)}
                  />
                  <ButtonGroupItem
                    iconOnly
                    accessibilityLabel={t('message.actions.replyAll')}
                    leadingIcon={RiArrowGoBackLine}
                    onPress={() => handleReplyAll(replyableMessage._id)}
                  />
                  <ButtonGroupItem
                    iconOnly
                    accessibilityLabel={t('message.actions.forward')}
                    leadingIcon={RiShareForwardLine}
                    onPress={() => handleForward(replyableMessage._id)}
                  />
                </ButtonGroup>
              )}
              <ButtonGroup>
                <ButtonGroupItem
                  iconOnly
                  accessibilityLabel={t(
                    archived ? 'message.actions.moveToInbox' : 'message.actions.archive',
                  )}
                  leadingIcon={archived ? RiInbox2Line : RiArchiveLine}
                  onPress={handleArchive}
                />
                <ButtonGroupItem
                  iconOnly
                  accessibilityLabel={t('message.actions.snooze')}
                  leadingIcon={RiTimeLine}
                  onPress={() => setSnoozeVisible(true)}
                />
                <ButtonGroupItem
                  iconOnly
                  accessibilityLabel={t('message.actions.reportSpam')}
                  leadingIcon={RiSpamLine}
                  onPress={handleMarkSpam}
                />
                <ButtonGroupItem
                  iconOnly
                  accessibilityLabel={t('message.actions.delete')}
                  leadingIcon={RiDeleteBinLine}
                  onPress={handleDelete}
                />
              </ButtonGroup>
              <ButtonGroup>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild label={t('ui.drawer.folders')}>
                    <ButtonGroupItem
                      iconOnly
                      accessibilityLabel={t('ui.drawer.folders')}
                      leadingIcon={RiFolderLine}
                    />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {mailboxes
                      .filter((mailbox) => mailbox._id !== currentMessage.mailboxId)
                      .map((mailbox) => (
                        <DropdownMenuItem
                          key={mailbox._id}
                          leading={<RiFolderLine />}
                          onPress={() => handleMoveToFolder(mailbox._id)}
                        >
                          {mailbox.name}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild label={t('message.actions.label')}>
                    <ButtonGroupItem
                      iconOnly
                      accessibilityLabel={t('message.actions.label')}
                      leadingIcon={RiPriceTag3Line}
                    />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {labels.length === 0 && (
                      <DropdownMenuItem disabled>{t('message.labelPicker.empty')}</DropdownMenuItem>
                    )}
                    {labels.map((label) => (
                      <DropdownMenuCheckboxItem
                        key={label._id}
                        checked={currentMessage.labels.includes(label.name)}
                        onCheckedChange={() => handleToggleLabel(label.name)}
                        leading={<RiPriceTag3Line fill={label.color} />}
                        indicatorPosition="trailing"
                        keepOpen
                      >
                        {label.name}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <ButtonGroupItem
                  iconOnly
                  accessibilityLabel={t(
                    currentMessage.flags.starred
                      ? 'message.actions.unstar'
                      : 'message.actions.star',
                  )}
                  leadingIcon={currentMessage.flags.starred ? RiStarFill : RiStarLine}
                  onPress={handleStar}
                  disabled={toggleStar.isPending}
                />
              </ButtonGroup>
            </>
          }
          sticky={false}
          scrim="auto"
          scrimColor={bloomColors.card}
          testID="message-header"
          safeArea={false}
          actions={
            <ButtonGroup>
              <ButtonGroupItem
                iconOnly
                accessibilityLabel={t('message.actions.markUnread')}
                leadingIcon={RiMailLine}
                onPress={handleMarkUnread}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild label={t('message.actions.more')}>
                  <ButtonGroupItem
                    iconOnly
                    accessibilityLabel={t('message.actions.more')}
                    leadingIcon={RiMoreLine}
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem
                    leading={<RiPushpinLine />}
                    onPress={handlePin}
                    disabled={togglePin.isPending}
                  >
                    {t(
                      currentMessage.flags.pinned ? 'message.actions.unpin' : 'message.actions.pin',
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    leading={<RiCalendarLine />}
                    onPress={() =>
                      setReminderTarget({
                        id: currentMessage._id,
                        key: ++reminderEditorId.current,
                        owner: reminderOwner,
                        mutate: createReminder.mutateAsync,
                      })
                    }
                  >
                    {t('reminder.create.title')}
                  </DropdownMenuItem>
                  <DropdownMenuItem leading={<RiPrinterLine />} onPress={handlePrint}>
                    {t('message.actions.print')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onPress={handleDownloadEml}>
                    {t('message.actions.downloadEml')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </ButtonGroup>
          }
        />
      }
      bottomBar={
        !replyMode &&
        threadDraft && (
          <PageFooter
            scrim="auto"
            scrimColor={bloomColors.card}
            safeArea={false}
            testID="message-reply-footer"
            actions={
              <Button leadingIcon={RiDraftLine} onPress={() => handleEditDraft(threadDraft)}>
                {t('message.actions.editDraft')}
              </Button>
            }
          />
        )
      }
    >
      <ScreenScrollView
        testID="message-scroll"
        style={styles.body}
        contentContainerStyle={{
          paddingTop: tokens.space.md,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <ThreadOverview
          key={messageId}
          messageId={messageId}
          subject={currentMessage.subject || t('message.detail.noSubject')}
          messages={sortedThread}
          count={threadEntries.length}
          labels={assignedLabels}
          sentiment={sentiment}
          onRemoveLabel={handleToggleLabel}
        />

        {/* Rich card for structured data (flights, orders, etc.) */}
        {currentMessage.card && (
          <View style={styles.cardSection}>
            <CardRenderer card={currentMessage.card} />
          </View>
        )}

        {/* Highlights (key data points) */}
        {currentMessage.highlights && currentMessage.highlights.length > 0 && (
          <Card appearance="outline">
            <CardBody>
              {currentMessage.highlights.map((h, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a read-only list that never reorders; labels can repeat.
                <View key={i} style={styles.highlightRow}>
                  <Text style={[styles.highlightLabel, { color: colors.secondaryText }]}>
                    {h.label}
                  </Text>
                  <Text style={[styles.highlightValue, { color: colors.text }]}>{h.value}</Text>
                </View>
              ))}
            </CardBody>
          </Card>
        )}

        {/* Stale thread banner - gentle nudge to reply */}
        <StaleThreadBanner staleInfo={staleInfo} onReply={() => handleReply()} />

        {/* Bloom owns the conversation chrome; Inbox retains safe HTML and unreadable entries. */}
        {threadUnreadable.length === 0 ? (
          <MailThread
            messages={sortedThread.map(toThreadMessage)}
            expandedIds={[...expandedMessages]}
            onExpandedIdsChange={(ids) => setExpandedMessages(new Set(ids))}
            collapseAfter={0}
            strings={threadStrings}
          />
        ) : (
          <View style={{ gap: tokens.space.md }}>
            {threadEntries.map((entry) =>
              entry.kind === 'unreadable' ? (
                <UnreadableThreadEntry
                  key={entry.key}
                  row={entry.row}
                  onRetry={() => void refetchThread()}
                  onOpenRaw={handleOpenRaw}
                />
              ) : (
                <MailMessage
                  key={entry.message._id}
                  {...toThreadMessage(entry.message)}
                  expanded={expandedMessages.has(entry.message._id)}
                  onExpandedChange={() => toggleMessageExpanded(entry.message._id)}
                  strings={threadStrings}
                />
              ),
            )}
          </View>
        )}

        {/* Inline reply - appears at bottom of thread, inside scroll area */}
        {replyMode && (
          <View style={[styles.inlineReplyWrapper, { marginTop: tokens.space.md }]}>
            <InlineReply
              key={`${replyMode}:${replyTargetId ?? currentMessage._id}`}
              message={
                (replyTargetId ? sortedThread.find((m) => m._id === replyTargetId) : undefined) ??
                (currentMessage.flags.draft ? replyableMessage : currentMessage) ??
                currentMessage
              }
              mode={replyMode}
              onClose={handleCloseReply}
            />
          </View>
        )}
      </ScreenScrollView>

      <CreateReminderSheet
        key={reminderTarget?.key ?? 'closed-reminder'}
        visible={reminderTarget?.id === currentMessage._id}
        onClose={() =>
          setReminderTarget((current) => (current === reminderTarget ? null : current))
        }
        onCreate={handleCreateReminder}
        relatedMessageId={reminderTarget?.id}
        unavailableMessage={
          reminderTarget && !isCurrentEmailOwner(reminderTarget.owner)
            ? t('ui.mutations.reminderEditorUnavailable')
            : undefined
        }
      />

      {/* Snooze sheet */}
      <SnoozeSheet
        visible={snoozeVisible}
        onClose={() => setSnoozeVisible(false)}
        onSnooze={handleSnooze}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  body: {
    flex: 1,
  },
  cardSection: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  highlightLabel: {
    fontSize: 12,
    fontWeight: '500',
    minWidth: 80,
  },
  highlightValue: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  inlineReplyWrapper: {
    width: '100%',
  },
});
