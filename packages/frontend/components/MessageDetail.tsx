import { BREAKPOINTS, tokens } from '@oxy.so/bloom/styles';
import { TopEdgeProvider, useBottomEdgeInset, useTopEdgeInset } from '@oxy.so/bloom/layout';
import { useTheme } from '@oxy.so/bloom/theme';
import {
  PageFooter,
  PageFooterProvider,
  usePageFooterInset,
} from '@oxy.so/bloom/page-footer';
import {
  Card,
  CardBody,
} from '@oxy.so/bloom/card';
import { EmptyState } from '@oxy.so/bloom/empty-state';
import { EmptyStateSticker } from '@/components/EmptyStateSticker';
import { Text } from '@oxy.so/bloom/typography';
import { useAppShell } from '@oxy.so/bloom/app-shell';
import { ButtonGroup, ButtonGroupItem } from '@oxy.so/bloom/button-group';
import { Button, IconButton } from '@oxy.so/bloom/button';
import { Checkbox } from '@oxy.so/bloom/checkbox';
import {
  RiArchiveLine,
  RiArrowGoBackLine,
  RiCornerUpLeftLine,
  RiDeleteBinLine,
  RiDraftLine,
  RiMailLine,
  RiMenuLine,
  RiMoreLine,
  RiPrinterLine,
  RiPushpinLine,
  RiShareForwardLine,
  RiStarFill,
  RiStarLine,
  RiTimeLine,
} from '@oxy.so/bloom/icons';
import {
  MailMessage,
  MailThread,
  type MailThreadMessage,
} from '@oxy.so/bloom/mail-thread';
import { PageHeader } from '@oxy.so/bloom/page-header';
/**
 * Reusable message detail view.
 *
 * Supports two modes:
 * - standalone: full-screen route with back button (mobile)
 * - embedded: inline panel without back button (desktop split-view)
 */

import { Dialog, ScrollArea, ScrollMetricsProvider, toast, useDialogControl } from '@oxy.so/bloom';
import { Loading } from '@oxy.so/bloom/loading';
import { useOxy } from '@oxy.so/services';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { usePathname, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWindowDimensions, Linking, Platform, StyleSheet, View } from 'react-native';

import { HtmlBody } from '@/components/HtmlBody';
import { InlineReply } from '@/components/InlineReply';
import { SnoozeSheet } from '@/components/SnoozeSheet';
import { StaleThreadBanner } from '@/components/StaleThreadBanner';
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
import { useTranslation } from '@/lib/i18n';
import type { Message } from '@/services/emailApi';
import { messageRoute } from '@/utils/messageRoute';
import { buildPrintHtml, printHtmlOnWeb } from '@/utils/printMessage';
import { safeDownloadFilename } from '@/utils/downloadFilename';
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

function getSnippet(text: string | null | undefined, maxLength = 100): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > maxLength ? clean.slice(0, maxLength) + '...' : clean;
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
  return (
    <PageFooterProvider key={props.messageId}>
      <TopEdgeProvider>
        <ScrollMetricsProvider>
          <MessageDetailInner {...props} />
        </ScrollMetricsProvider>
      </TopEdgeProvider>
    </PageFooterProvider>
  );
}

function MessageDetailInner({ mode, messageId }: MessageDetailProps) {
  const shell = useAppShell();
  const occupiedBottom = useBottomEdgeInset();
  const footerClearance = usePageFooterInset();
  const headerClearance = useTopEdgeInset();
  const { colors: bloomColors } = useTheme();
  const { width: viewportWidth } = useWindowDimensions();
  const bottomClearance = viewportWidth < BREAKPOINTS.md ? occupiedBottom : 0;
  const pathname = usePathname();
  const colors = useColors();
  const { t, locale } = useTranslation();

  const {
    data: currentMessage,
    isLoading,
    isError,
    refetch,
  } = useMessage(messageId);
  const {
    data: threadData,
    refetch: refetchThread,
    isPending: threadLoading,
  } = useThread(messageId);
  const threadMessages = useMemo(
    () => threadData?.messages ?? [],
    [threadData],
  );
  const threadUnreadable = useMemo(
    () => threadData?.unreadable ?? [],
    [threadData],
  );
  const sortedThread = useMemo(() => {
    if (threadMessages.length === 0)
      return currentMessage ? [currentMessage] : [];
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
    return members.some((m) => m._id === currentMessage._id) ? members : [...members, currentMessage];
  }, [sortedThread, currentMessage]);

  const emailApi = useEmailStore((s) => s._api);
  const { data: mailboxes = [] } = useMailboxes();
  const { data: labels = [] } = useLabels();
  const toggleStar = useToggleStar();
  const messageActions = useMessageActions();
  const { prefs } = useInboxPrefs();
  const updateLabels = useUpdateMessageLabels();
  const togglePin = useTogglePin();

  const [snoozeVisible, setSnoozeVisible] = useState(false);
  const [replyMode, setReplyMode] = useState<
    'reply' | 'reply-all' | 'forward' | null
  >(null);
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(
    new Set([messageId]),
  );
  const [messageMenuId, setMessageMenuId] = useState<string | null>(null);

  const moreMenuControl = useDialogControl();
  const labelPickerControl = useDialogControl();
  const messageMenuControl = useDialogControl();

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
  }, [prefs.markReadOnOpen, currentMessage, messageId, threadLoading, sortedThread, messageActions]);

  const backFallback = pathname.startsWith('/search') ? '/search' : '/';
  const handleBack = useGoBack(backFallback);

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
      messageActions.snooze(folderConversation, until.toISOString());
      setSnoozeVisible(false);
      if (mode === 'standalone') handleBack();
    },
    [messageId, messageActions, folderConversation, handleBack, mode],
  );

  const handleArchive = useCallback(() => {
    if (!messageId) return;
    if (!mailboxes.some((m) => m.specialUse === SPECIAL_USE.ARCHIVE)) {
      toast.error(t('inbox.toast.archiveUnavailable'));
      return;
    }
    messageActions.archive(folderConversation);
    if (mode === 'standalone') handleBack();
  }, [messageId, mailboxes, messageActions, folderConversation, handleBack, mode, t]);

  const handleDelete = useCallback(() => {
    if (!messageId) return;
    // Permanently or to Trash is decided per message from where it IS (see
    // useMessageActions). It was decided from the folder last browsed: opened
    // from a notification after visiting Trash, an Inbox message was destroyed.
    messageActions.deleteConversation(folderConversation);
    if (mode === 'standalone') handleBack();
  }, [messageId, messageActions, folderConversation, handleBack, mode]);

  const handleMarkUnread = useCallback(() => {
    if (!currentMessage) return;
    messageActions.setRead([currentMessage], false);
    moreMenuControl.close();
    if (mode === 'standalone') handleBack();
  }, [currentMessage, messageActions, handleBack, mode, moreMenuControl]);

  const handleMarkSpam = useCallback(() => {
    if (!messageId) return;
    const spamBox = mailboxes.find((m) => m.specialUse === SPECIAL_USE.SPAM);
    moreMenuControl.close();
    if (!spamBox) {
      toast.error(t('message.toast.spamUnavailable'));
      return;
    }
    messageActions.moveTo(folderConversation, spamBox._id);
    if (mode === 'standalone') handleBack();
  }, [
    messageId,
    mailboxes,
    messageActions,
    folderConversation,
    handleBack,
    mode,
    moreMenuControl,
    t,
  ]);

  const handleReply = useCallback(
    (targetMsgId?: string) => {
      if (!currentMessage) return;
      setReplyTargetId(targetMsgId || null);
      setReplyMode('reply');
      setMessageMenuId(null);
    },
    [currentMessage],
  );

  const handleReplyAll = useCallback(
    (targetMsgId?: string) => {
      if (!currentMessage) return;
      setReplyTargetId(targetMsgId || null);
      setReplyMode('reply-all');
      setMessageMenuId(null);
    },
    [currentMessage],
  );

  const handleForward = useCallback(
    (targetMsgId?: string) => {
      if (!currentMessage) return;
      setReplyTargetId(targetMsgId || null);
      setReplyMode('forward');
      setMessageMenuId(null);
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
  const router = useRouter();
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
        toast.error(
          err instanceof Error
            ? err.message
            : t('message.toast.downloadFailed'),
        );
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
    () => new Map(sortedThread.map((message) => [
      message._id,
      message.html
        ? splitHtmlQuote(resolvedHtmlMap[message._id] ?? message.html)
        : splitTextQuote(message.text ?? ''),
    ])),
    [sortedThread, resolvedHtmlMap],
  );

  const handleAttachment = useCallback(
    async (fileId: string, filename: string) => {
      if (Platform.OS === 'web') {
        // The window is opened IN the tap, then pointed at the file once its
        // signed URL arrives: opened after the await, it is a popup that
        // Safari and strict blockers refuse — and nothing said so.
        const tab = window.open('', '_blank');
        try {
          const url = await oxyServices.assets.url(fileId);
          if (tab) {
            tab.opener = null;
            tab.location.href = url;
          } else {
            window.location.assign(url);
          }
        } catch (error: unknown) {
          tab?.close();
          toast.error(error instanceof Error ? error.message : t('message.toast.attachmentFailed'));
        }
        return;
      }
      try {
        const url = await oxyServices.assets.url(fileId);
        // A cache file: the OS may reclaim it, nothing piles up in Documents.
        const cacheDirectory = FileSystem.cacheDirectory;
        if (!cacheDirectory) {
          await Linking.openURL(url);
          return;
        }
        const download = await FileSystem.downloadAsync(url, cacheDirectory + safeDownloadFilename(filename));
        // An expired link or a refusal downloads an error page; never hand
        // that to the share sheet as the user's file.
        if (download.status < 200 || download.status >= 300) {
          throw new Error(t('message.toast.attachmentFailed'));
        }
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(download.uri);
        } else {
          await Linking.openURL(url);
        }
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : t('message.toast.attachmentFailed'));
      }
    },
    [oxyServices, t],
  );

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
          const message =
            err instanceof Error ? err.message : t('message.toast.printFailed');
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
    moreMenuControl.close();
    void downloadSource(currentMessage._id, currentMessage.subject);
  }, [currentMessage, downloadSource, moreMenuControl]);

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

  if (isLoading) {
    return (
      <View style={styles.container}>
        {standaloneToolbar}
        <View style={styles.loadingContainer}>
          <Loading />
        </View>
      </View>
    );
  }

  if (isError || !currentMessage) {
    return (
      <View className="flex-1">
        {standaloneToolbar}
        <EmptyState
          illustration={
            <EmptyStateSticker name={isError ? 'loadError' : 'notFound'} />
          }
          title={t(isError ? 'ui.message.loadError' : 'ui.message.notFound')}
          description={t(
            isError
              ? 'ui.message.loadErrorDescription'
              : 'ui.message.notFoundDescription',
          )}
          action={
            isError
              ? { label: t('common.retry'), onPress: () => void refetch() }
              : undefined
          }
        />
      </View>
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
    const parts = messageParts.get(msg._id)!;
    const renderBody = (content: string) => msg.html
      ? <HtmlBody html={content} />
      : <Text selectable>{content}</Text>;
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
        if (!toggleStar.isPending)
          toggleStar.mutate({ messageId: msg._id, starred });
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
        <IconButton
          accessibilityLabel={t('message.actions.more')}
          icon={<RiMoreLine />}
          onPress={() => {
            setMessageMenuId(msg._id);
            messageMenuControl.open();
          }}
        />
      ),
      ...(msg.flags.draft ? { time: t('message.draftLabel') } : {}),
      children: (
        <>
          {parts.body.trim()
            ? renderBody(parts.body)
            : parts.quoted ? null : <Text>{t('message.detail.emptyMessage')}</Text>}
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
    <View style={styles.container}>
      <PageHeader
        onBack={handleBack}
        backLabel={t('common.back')}
        leading={
          shell.drawerAvailable ? (
            <ButtonGroup accessibilityLabel={t('search.openMenu')}>
              <ButtonGroupItem
                iconOnly
                leadingIcon={RiMenuLine}
                accessibilityLabel={t('search.openMenu')}
                onPress={shell.openDrawer}
              />
            </ButtonGroup>
          ) : undefined
        }
        sticky={false}
        placement="overlay"
        scrim="auto"
        scrimColor={bloomColors.card}
        testID="message-header"
        safeArea={false}
        actions={
          <ButtonGroup>
            <ButtonGroupItem
              iconOnly
              accessibilityLabel={t('message.actions.archive')}
              leadingIcon={RiArchiveLine}
              onPress={handleArchive}
            />
            <ButtonGroupItem
              iconOnly
              accessibilityLabel={t('message.actions.delete')}
              leadingIcon={RiDeleteBinLine}
              onPress={handleDelete}
            />
            <ButtonGroupItem
              iconOnly
              accessibilityLabel={t(
                currentMessage.flags.starred
                  ? 'message.actions.unstar'
                  : 'message.actions.star',
              )}
              leadingIcon={
                currentMessage.flags.starred ? RiStarFill : RiStarLine
              }
              onPress={handleStar}
              disabled={toggleStar.isPending}
            />
            <ButtonGroupItem
              iconOnly
              accessibilityLabel={t('message.actions.more')}
              leadingIcon={RiMoreLine}
              onPress={() => moreMenuControl.open()}
            />
          </ButtonGroup>
        }
      />

      <Dialog control={moreMenuControl} label={t('message.actions.more')}>
        <View className="gap-2">
          <Button
            appearance="subtle"
            leading={<RiMailLine />}
            onPress={handleMarkUnread}
          >
            {t('message.actions.markUnread')}
          </Button>
          <Button
            appearance="subtle"
            leading={<RiPushpinLine />}
            onPress={() => {
              moreMenuControl.close();
              handlePin();
            }}
            disabled={togglePin.isPending}
          >
            {t(
              currentMessage.flags.pinned
                ? 'message.actions.unpin'
                : 'message.actions.pin',
            )}
          </Button>
          <Button
            appearance="subtle"
            leading={<RiTimeLine />}
            onPress={() => {
              moreMenuControl.close();
              setSnoozeVisible(true);
            }}
          >
            {t('message.actions.snooze')}
          </Button>
          <Button
            appearance="subtle"
            leading={<RiPrinterLine />}
            onPress={() => {
              moreMenuControl.close();
              handlePrint();
            }}
          >
            {t('message.actions.print')}
          </Button>
          <Button appearance="subtle" onPress={handleMarkSpam}>
            {t('message.actions.reportSpam')}
          </Button>
          <Button
            appearance="subtle"
            onPress={() => {
              moreMenuControl.close();
              labelPickerControl.open();
            }}
          >
            {t('message.actions.label')}
          </Button>
          <Button appearance="subtle" onPress={handleDownloadEml}>
            {t('message.actions.downloadEml')}
          </Button>
        </View>
      </Dialog>

      {/* Label picker dialog */}
      <Dialog
        control={labelPickerControl}
        label={t('message.labelPicker.title')}
        style={{ padding: 0 }}
      >
        <Text style={[styles.labelPickerTitle, { color: colors.text }]}>
          {t('message.labelPicker.title')}
        </Text>
        {labels.length === 0 && (
          <EmptyState
            variant="compact"
            illustration={<EmptyStateSticker name="conversation" size={80} />}
            title={t('message.labelPicker.empty')}
            description={t('empty.labelsDescription')}
          />
        )}
        {labels.map((label) => (
          <Checkbox
            key={label._id}
            checked={currentMessage.labels.includes(label.name)}
            onCheckedChange={() => handleToggleLabel(label.name)}
            label={label.name}
          />
        ))}
      </Dialog>

      <ScrollArea
        testID="message-scroll"
        style={styles.body}
        contentContainerStyle={{
          paddingTop: headerClearance + tokens.space.md,
          paddingBottom: Math.max(bottomClearance, footerClearance),
        }}
        showsVerticalScrollIndicator={false}
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
                <View key={i} style={styles.highlightRow}>
                  <Text
                    style={[
                      styles.highlightLabel,
                      { color: colors.secondaryText },
                    ]}
                  >
                    {h.label}
                  </Text>
                  <Text style={[styles.highlightValue, { color: colors.text }]}>
                    {h.value}
                  </Text>
                </View>
              ))}
            </CardBody>
          </Card>
        )}

        {/* Stale thread banner - gentle nudge to reply */}
        <StaleThreadBanner
          staleInfo={staleInfo}
          onReply={() => handleReply()}
        />

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
                  onExpandedChange={() =>
                    toggleMessageExpanded(entry.message._id)
                  }
                  strings={threadStrings}
                />
              ),
            )}
          </View>
        )}

        {/* Inline reply - appears at bottom of thread, inside scroll area */}
        {replyMode && (
          <View
            style={[styles.inlineReplyWrapper, { marginTop: tokens.space.md }]}
          >
            <InlineReply
              key={`${replyMode}:${replyTargetId ?? currentMessage._id}`}
              message={
                (replyTargetId
                  ? sortedThread.find((m) => m._id === replyTargetId)
                  : undefined) ??
                (currentMessage.flags.draft ? replyableMessage : currentMessage) ??
                currentMessage
              }
              mode={replyMode}
              onClose={handleCloseReply}
            />
          </View>
        )}
      </ScrollArea>

      {/* Snooze sheet */}
      <SnoozeSheet
        visible={snoozeVisible}
        onClose={() => setSnoozeVisible(false)}
        onSnooze={handleSnooze}
      />

      <Dialog
        control={messageMenuControl}
        onClose={() => setMessageMenuId(null)}
        label={t('message.actions.messageActions')}
      >
        <View className="gap-2">
          <Button
            appearance="subtle"
            leading={<RiCornerUpLeftLine />}
            onPress={() => {
              messageMenuControl.close();
              handleReply(messageMenuId ?? undefined);
            }}
          >
            {t('message.actions.reply')}
          </Button>
          <Button
            appearance="subtle"
            leading={<RiArrowGoBackLine />}
            onPress={() => {
              messageMenuControl.close();
              handleReplyAll(messageMenuId ?? undefined);
            }}
          >
            {t('message.actions.replyAll')}
          </Button>
          <Button
            appearance="subtle"
            leading={<RiShareForwardLine />}
            onPress={() => {
              messageMenuControl.close();
              handleForward(messageMenuId ?? undefined);
            }}
          >
            {t('message.actions.forward')}
          </Button>
        </View>
      </Dialog>

      {!replyMode && (
        <PageFooter
          scrim="auto"
          scrimColor={bloomColors.card}
          bottomInset={bottomClearance}
          safeArea={false}
          testID="message-reply-footer"
          actions={
            <>
              {threadDraft && (
                <Button
                  leadingIcon={RiDraftLine}
                  onPress={() => handleEditDraft(threadDraft)}
                >
                  {t('message.actions.editDraft')}
                </Button>
              )}
              {replyableMessage && (
                <>
                  <Button
                    appearance={threadDraft ? 'subtle' : undefined}
                    leadingIcon={RiCornerUpLeftLine}
                    onPress={() => handleReply(replyableMessage._id)}
                  >
                    {t('message.actions.reply')}
                  </Button>
                  <Button
                    appearance="subtle"
                    leadingIcon={RiArrowGoBackLine}
                    onPress={() => handleReplyAll(replyableMessage._id)}
                  >
                    {t('message.actions.replyAll')}
                  </Button>
                  <Button
                    appearance="subtle"
                    leadingIcon={RiShareForwardLine}
                    onPress={() => handleForward(replyableMessage._id)}
                  >
                    {t('message.actions.forward')}
                  </Button>
                </>
              )}
            </>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  labelPickerTitle: {
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingBottom: 6,
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
