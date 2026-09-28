import { Button, IconButton } from '@oxy.so/bloom/button';
import { Checkbox } from '@oxy.so/bloom/checkbox';
import {
  RiArchiveLine,
  RiArrowGoBackLine,
  RiArrowLeftLine,
  RiCornerUpLeftLine,
  RiDeleteBinLine,
  RiMailLine,
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

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import { Dialog, toast, useDialogControl } from '@oxy.so/bloom';
import { Chip } from '@oxy.so/bloom/chip';
import { Loading } from '@oxy.so/bloom/loading';
import { useOxy } from '@oxy.so/services';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { usePathname } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useMemo, useState } from 'react';
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HtmlBody } from '@/components/HtmlBody';
import { InlineReply } from '@/components/InlineReply';
import { SentimentIndicator } from '@/components/SentimentIndicator';
import { SnoozeSheet } from '@/components/SnoozeSheet';
import { StaleThreadBanner } from '@/components/StaleThreadBanner';
import { ThreadSummary } from '@/components/ThreadSummary';
import { UnreadableThreadEntry } from '@/components/UnreadableThreadEntry';
import { CardRenderer } from '@/components/cards/CardRenderer';
import { SPECIAL_USE } from '@/constants/mailbox';
import { useColors } from '@/constants/theme';
import {
  useArchiveMessage,
  useDeleteMessage,
  useSnoozeMessage,
  useTogglePin,
  useToggleRead,
  useToggleStar,
  useUpdateMessageLabels,
} from '@/hooks/mutations/useMessageMutations';
import { useLabels } from '@/hooks/queries/useLabels';
import { useMailboxes } from '@/hooks/queries/useMailboxes';
import { useMessage } from '@/hooks/queries/useMessage';
import { useSentimentAnalysis } from '@/hooks/queries/useSentimentAnalysis';
import { useStaleThread } from '@/hooks/queries/useStaleThread';
import { useThread } from '@/hooks/queries/useThread';
import { useCidResolver } from '@/hooks/useCidResolver';
import { useEmailStore } from '@/hooks/useEmail';
import { useGoBack } from '@/hooks/useGoBack';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { useTranslation } from '@/lib/i18n';
import type { Message } from '@/services/emailApi';
import { safeDownloadFilename } from '@/utils/downloadFilename';
import { emlFilename, saveEmlFile } from '@/utils/saveEml';
import { buildThreadEntries } from '@/utils/threadEntries';

function formatFullDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isThisYear = date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  if (isThisYear) {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  }
  return date.toLocaleDateString(undefined, {
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
  return <MessageDetailInner key={props.messageId} {...props} />;
}

function MessageDetailInner({ mode, messageId }: MessageDetailProps) {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const pathname = usePathname();
  const colors = useColors();
  const { t } = useTranslation();

  const {
    data: currentMessage,
    isLoading,
    isError,
    refetch,
  } = useMessage(messageId);
  const { data: threadData, refetch: refetchThread } = useThread(messageId);
  const threadMessages = useMemo(
    () => threadData?.messages ?? [],
    [threadData],
  );
  const threadUnreadable = useMemo(
    () => threadData?.unreadable ?? [],
    [threadData],
  );
  const emailApi = useEmailStore((s) => s._api);
  const { data: mailboxes = [] } = useMailboxes();
  const { data: labels = [] } = useLabels();
  const currentMailbox = useEmailStore((s) => s.currentMailbox);
  const toggleStar = useToggleStar();
  const toggleRead = useToggleRead();
  const archiveMutation = useArchiveMessage();
  const deleteMutation = useDeleteMessage();
  const updateLabels = useUpdateMessageLabels();
  const togglePin = useTogglePin();
  const snoozeMutation = useSnoozeMessage();

  const [snoozeVisible, setSnoozeVisible] = useState(false);
  const [replyMode, setReplyMode] = useState<
    'reply' | 'reply-all' | 'forward' | null
  >(null);
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(
    new Set([messageId]),
  );
  const [messageMenuId, setMessageMenuId] = useState<string | null>(null);
  const [threadSummaryRequested, setThreadSummaryRequested] = useState(false);

  const moreMenuControl = useDialogControl();
  const labelPickerControl = useDialogControl();
  const messageMenuControl = useDialogControl();

  // Sentiment analysis for the current message
  const sentiment = useSentimentAnalysis(currentMessage);

  // Get current user for stale thread detection
  const { user, oxyServices } = useOxy();
  const userEmail = user?.email;

  // Marking read is handled by the list tap (see InboxList.handleMessagePress),
  // driven by the markReadOnOpen preference. The detail view intentionally does
  // not mark read on open — a single, predictable path avoids double writes.

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
      snoozeMutation.mutate({ messageId, until: until.toISOString() });
      setSnoozeVisible(false);
      if (mode === 'standalone') handleBack();
    },
    [messageId, snoozeMutation, handleBack, mode],
  );

  const handleArchive = useCallback(() => {
    if (!messageId) return;
    const archiveBox = mailboxes.find(
      (m) => m.specialUse === SPECIAL_USE.ARCHIVE,
    );
    if (!archiveBox) {
      toast.error(t('inbox.toast.archiveUnavailable'));
      return;
    }
    archiveMutation.mutate({ messageId, archiveMailboxId: archiveBox._id });
    if (mode === 'standalone') handleBack();
  }, [messageId, mailboxes, archiveMutation, handleBack, mode, t]);

  const handleDelete = useCallback(() => {
    if (!messageId) return;
    const trashBox = mailboxes.find((m) => m.specialUse === SPECIAL_USE.TRASH);
    const isInTrash = currentMailbox?.specialUse === SPECIAL_USE.TRASH;
    deleteMutation.mutate({
      messageId,
      trashMailboxId: trashBox?._id,
      isInTrash,
    });
    if (mode === 'standalone') handleBack();
  }, [messageId, mailboxes, currentMailbox, deleteMutation, handleBack, mode]);

  const handleMarkUnread = useCallback(() => {
    if (!messageId) return;
    toggleRead.mutate({ messageId, seen: false });
    moreMenuControl.close();
    if (mode === 'standalone') handleBack();
  }, [messageId, toggleRead, handleBack, mode, moreMenuControl]);

  const handleMarkSpam = useCallback(() => {
    if (!messageId) return;
    const spamBox = mailboxes.find((m) => m.specialUse === SPECIAL_USE.SPAM);
    if (spamBox) {
      archiveMutation.mutate({ messageId, archiveMailboxId: spamBox._id });
    }
    moreMenuControl.close();
    if (mode === 'standalone') handleBack();
  }, [
    messageId,
    mailboxes,
    archiveMutation,
    handleBack,
    mode,
    moreMenuControl,
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
  const sortedThread = useMemo(() => {
    if (threadMessages.length === 0)
      return currentMessage ? [currentMessage] : [];
    return [...threadMessages].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  }, [threadMessages, currentMessage]);

  // Every row of the conversation, the unreadable ones in their place.
  const threadEntries = useMemo(
    () => buildThreadEntries(sortedThread, threadUnreadable),
    [sortedThread, threadUnreadable],
  );

  /** The server's raw source of a message this client could not read. */
  const handleOpenRaw = useCallback(
    async (rawMessageId: string) => {
      if (!emailApi) return;
      const row = threadUnreadable.find((entry) => entry._id === rawMessageId);
      try {
        const { content } = await emailApi.exportMessage(rawMessageId);
        await saveEmlFile(content, emlFilename(row?.subject), t);
      } catch (err: unknown) {
        toast.error(
          err instanceof Error
            ? err.message
            : t('message.toast.downloadFailed'),
        );
      }
    },
    [emailApi, t, threadUnreadable],
  );

  // Detect stale threads that need a response
  const staleInfo = useStaleThread(sortedThread, userEmail);

  // Resolve CID inline image references to signed File Manager URLs
  const resolvedHtmlMap = useCidResolver(sortedThread, oxyServices, messageId);

  const handleAttachment = useCallback(
    async (fileId: string, filename: string) => {
      try {
        const url = await oxyServices.assets.url(fileId);
        if (Platform.OS === 'web') {
          window.open(url, '_blank', 'noopener,noreferrer');
        } else {
          const documentDirectory = FileSystem.documentDirectory;
          if (!documentDirectory) {
            await Linking.openURL(url);
            return;
          }
          const localUri = documentDirectory + safeDownloadFilename(filename);
          const { uri } = await FileSystem.downloadAsync(url, localUri);
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri);
          } else {
            await Linking.openURL(url);
          }
        }
      } catch (error: unknown) {
        try {
          const url = await oxyServices.assets.url(fileId);
          await Linking.openURL(url);
        } catch (err: unknown) {
          const message =
            err instanceof Error
              ? err.message
              : error instanceof Error
                ? error.message
                : t('message.toast.attachmentFailed');
          toast.error(message);
        }
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
    const subject = currentMessage.subject || '(no subject)';
    const fromStr = currentMessage.from.name
      ? `${currentMessage.from.name} <${currentMessage.from.address}>`
      : currentMessage.from.address;
    const toStr = currentMessage.to
      .map((a) => (a.name ? `${a.name} <${a.address}>` : a.address))
      .join(', ');
    const ccStr =
      currentMessage.cc
        ?.map((a) => (a.name ? `${a.name} <${a.address}>` : a.address))
        .join(', ') || '';
    const dateStr = formatFullDate(currentMessage.date);
    const bodyHtml =
      currentMessage.html || `<pre>${currentMessage.text || ''}</pre>`;

    const printHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${subject}</title>
<style>
  body { margin: 0; padding: 24px; background: #fff; color: #000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.5; }
  .header { border-bottom: 1px solid #ddd; padding-bottom: 16px; margin-bottom: 16px; }
  .subject { font-size: 20px; font-weight: 400; margin: 0 0 12px 0; }
  .field { margin: 2px 0; }
  .label { font-weight: 600; display: inline-block; min-width: 50px; }
  .body { margin-top: 16px; }
  img { max-width: 100%; height: auto; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<div class="header">
  <h1 class="subject">${subject}</h1>
  <div class="field"><span class="label">From:</span> ${fromStr}</div>
  <div class="field"><span class="label">To:</span> ${toStr}</div>
  ${ccStr ? `<div class="field"><span class="label">Cc:</span> ${ccStr}</div>` : ''}
  <div class="field"><span class="label">Date:</span> ${dateStr}</div>
</div>
<div class="body">${bodyHtml}</div>
</body>
</html>`;

    if (Platform.OS === 'web') {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(printHtml);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
      }
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
  }, [currentMessage, t]);

  const handleDownloadEml = useCallback(() => {
    if (!currentMessage) return;
    moreMenuControl.close();

    const subject = currentMessage.subject || '(no subject)';
    const fromStr = currentMessage.from.name
      ? `${currentMessage.from.name} <${currentMessage.from.address}>`
      : currentMessage.from.address;
    const toStr = currentMessage.to
      .map((a) => (a.name ? `${a.name} <${a.address}>` : a.address))
      .join(', ');
    const ccStr =
      currentMessage.cc
        ?.map((a) => (a.name ? `${a.name} <${a.address}>` : a.address))
        .join(', ') || '';
    const dateStr = new Date(currentMessage.date).toUTCString();
    const msgId =
      currentMessage.messageId || `<${currentMessage._id}@inbox.oxy.so>`;
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const textBody = currentMessage.text || '';
    const htmlBody = currentMessage.html || '';

    let mimeBody: string;
    if (htmlBody && textBody) {
      mimeBody = [
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: quoted-printable',
        '',
        textBody,
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: quoted-printable',
        '',
        htmlBody,
        '',
        `--${boundary}--`,
      ].join('\r\n');
    } else if (htmlBody) {
      mimeBody = [
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: quoted-printable',
        '',
        htmlBody,
      ].join('\r\n');
    } else {
      mimeBody = [
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: quoted-printable',
        '',
        textBody || '',
      ].join('\r\n');
    }

    const headers = [
      `From: ${fromStr}`,
      `To: ${toStr}`,
      ...(ccStr ? [`Cc: ${ccStr}`] : []),
      `Subject: ${subject}`,
      `Date: ${dateStr}`,
      `Message-ID: ${msgId}`,
      'MIME-Version: 1.0',
    ].join('\r\n');

    const emlContent = `${headers}\r\n${mimeBody}`;

    void saveEmlFile(emlContent, emlFilename(subject), t);
  }, [currentMessage, moreMenuControl, t]);

  // Label data for assigned labels (backend stores label names, not IDs)
  const assignedLabels = useMemo(() => {
    if (!currentMessage) return [];
    return labels.filter((l) => currentMessage.labels.includes(l.name));
  }, [currentMessage, labels]);

  const shellStyle = [
    styles.container,
    mode === 'standalone' && { paddingTop: insets.top },
  ];

  const standaloneToolbar =
    mode === 'standalone' ? (
      <View
        style={[
          styles.toolbar,
          {
            paddingLeft: 4 + insets.left,
            paddingRight: 4 + insets.right,
          },
        ]}
      >
        <TouchableOpacity onPress={handleBack} style={styles.iconButton}>
          {Platform.OS === 'web' ? (
            <HugeiconsIcon
              icon={ArrowLeft01Icon as unknown as IconSvgElement}
              size={24}
              color={colors.icon}
            />
          ) : (
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={colors.icon}
            />
          )}
        </TouchableOpacity>
      </View>
    ) : null;

  if (isLoading) {
    return (
      <View style={shellStyle}>
        {standaloneToolbar}
        <View style={styles.loadingContainer}>
          <Loading />
        </View>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={shellStyle}>
        {standaloneToolbar}
        <View style={styles.loadingContainer}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {t('ui.message.loadError')}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.secondaryText }]}>
            {t('ui.message.loadErrorDescription')}
          </Text>
          <TouchableOpacity
            onPress={() => refetch()}
            style={styles.retryButton}
          >
            <Text style={[styles.retryButtonText, { color: colors.primary }]}>
              {t('common.retry')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!currentMessage) {
    return (
      <View style={shellStyle}>
        {standaloneToolbar}
        <View style={styles.loadingContainer}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {t('ui.message.notFound')}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.secondaryText }]}>
            {t('ui.message.notFoundDescription')}
          </Text>
        </View>
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
  const toThreadMessage = (msg: Message): MailThreadMessage => ({
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
    date: formatFullDate(msg.date),
    time: formatShortDate(msg.date),
    preview: getSnippet(msg.text),
    unread: !msg.flags.seen,
    starred: msg.flags.starred,
    onStarredChange: (starred) => {
      if (!toggleStar.isPending)
        toggleStar.mutate({ messageId: msg._id, starred });
    },
    onReply: () => handleReply(msg._id),
    onReplyAll: () => handleReplyAll(msg._id),
    onForward: () => handleForward(msg._id),
    attachments: msg.attachments.map((attachment) => ({
      id: attachment.fileId,
      name: attachment.name,
      onPress: () => handleAttachment(attachment.fileId, attachment.name),
    })),
    menu: (
      <IconButton
        accessibilityLabel={t('message.actions.more')}
        icon={<RiMoreLine />}
        onPress={() => {
          setMessageMenuId(msg._id);
          messageMenuControl.open();
        }}
      />
    ),
    children: msg.html ? (
      <HtmlBody html={resolvedHtmlMap[msg._id] ?? msg.html} />
    ) : (
      <Text selectable style={{ color: colors.text }}>
        {msg.text || t('message.detail.emptyMessage')}
      </Text>
    ),
  });

  return (
    <View
      style={[
        styles.container,
        mode === 'standalone' && { paddingTop: insets.top },
      ]}
    >
      <PageHeader
        leading={
          <IconButton
            accessibilityLabel={t('common.back')}
            icon={<RiArrowLeftLine />}
            onPress={handleBack}
          />
        }
        actions={
          <View className="flex-row items-center gap-1">
            <IconButton
              accessibilityLabel={t('message.actions.archive')}
              icon={<RiArchiveLine />}
              onPress={handleArchive}
            />
            <IconButton
              accessibilityLabel={t('message.actions.delete')}
              icon={<RiDeleteBinLine />}
              onPress={handleDelete}
            />
            <IconButton
              accessibilityLabel={t(
                currentMessage.flags.starred
                  ? 'message.actions.unstar'
                  : 'message.actions.star',
              )}
              icon={
                currentMessage.flags.starred ? <RiStarFill /> : <RiStarLine />
              }
              onPress={handleStar}
              disabled={toggleStar.isPending}
            />
            <IconButton
              accessibilityLabel={t('message.actions.more')}
              icon={<RiMoreLine />}
              onPress={() => moreMenuControl.open()}
            />
          </View>
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
          <Text
            style={[styles.labelPickerEmpty, { color: colors.secondaryText }]}
          >
            {t('message.labelPicker.empty')}
          </Text>
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

      <ScrollView
        style={styles.body}
        contentContainerStyle={[
          styles.bodyContent,
          {
            paddingBottom:
              replyMode && mode === 'standalone' ? tabBarClearance + 16 : 16,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Subject and metadata - with horizontal padding */}
        <View style={styles.contentPadded}>
          <View style={styles.subjectRow}>
            <Text style={[styles.subject, { color: colors.text }]}>
              {currentMessage.subject || t('message.detail.noSubject')}
            </Text>
            {sentiment && (
              <SentimentIndicator
                sentiment={sentiment}
                size="medium"
                showLabel
              />
            )}
          </View>

          {/* Label chips */}
          {assignedLabels.length > 0 && (
            <View style={styles.labelChips}>
              {assignedLabels.map((lbl) => (
                <Chip
                  key={lbl._id}
                  variant="subtle"
                  size="small"
                  onClose={() => handleToggleLabel(lbl.name)}
                >
                  {lbl.name}
                </Chip>
              ))}
            </View>
          )}

          {/* Thread count indicator */}
          {threadEntries.length > 1 && (
            <View
              style={[
                styles.threadCount,
                { backgroundColor: colors.surfaceVariant },
              ]}
            >
              <Text
                style={[
                  styles.threadCountText,
                  { color: colors.secondaryText },
                ]}
              >
                {t(
                  threadEntries.length === 1
                    ? 'ui.message.conversationMessages_one'
                    : 'ui.message.conversationMessages_other',
                  { count: threadEntries.length },
                )}
              </Text>
            </View>
          )}

          {/* AI Thread Summary - explicit opt-in before Oxy processes bounded thread content. */}
          {sortedThread.length >= 4 &&
            (threadSummaryRequested ? (
              <ThreadSummary
                messageId={messageId}
                messages={sortedThread}
                minMessages={4}
              />
            ) : (
              <TouchableOpacity
                style={[
                  styles.threadSummaryPrompt,
                  {
                    backgroundColor: colors.surfaceVariant,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => setThreadSummaryRequested(true)}
                activeOpacity={0.75}
              >
                <MaterialCommunityIcons
                  name="robot-outline"
                  size={18}
                  color={colors.primary}
                />
                <View style={styles.threadSummaryPromptText}>
                  <Text
                    style={[
                      styles.threadSummaryPromptTitle,
                      { color: colors.text },
                    ]}
                  >
                    {t('ui.message.summaryTitle')}
                  </Text>
                  <Text
                    style={[
                      styles.threadSummaryPromptDescription,
                      { color: colors.secondaryText },
                    ]}
                  >
                    {t('ui.message.summaryDescription')}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
        </View>

        {/* Rich card for structured data (flights, orders, etc.) */}
        {currentMessage.card && (
          <View style={styles.cardSection}>
            <CardRenderer card={currentMessage.card} />
          </View>
        )}

        {/* Highlights (key data points) */}
        {currentMessage.highlights && currentMessage.highlights.length > 0 && (
          <View
            style={[styles.highlightsSection, { borderColor: colors.border }]}
          >
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
          </View>
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
          threadEntries.map((entry) =>
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
          )
        )}

        {/* Inline reply - appears at bottom of thread, inside scroll area */}
        {replyMode && (
          <View style={[styles.inlineReplyWrapper, { marginTop: 16 }]}>
            <InlineReply
              key={`${replyMode}:${replyTargetId ?? currentMessage._id}`}
              message={
                replyTargetId
                  ? sortedThread.find((m) => m._id === replyTargetId) ||
                    currentMessage
                  : currentMessage
              }
              mode={replyMode}
              onClose={handleCloseReply}
            />
          </View>
        )}
      </ScrollView>

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
        <View className="flex-row flex-wrap gap-2 p-3">
          <Button
            leading={<RiCornerUpLeftLine />}
            onPress={() => handleReply()}
          >
            {t('message.actions.reply')}
          </Button>
          <Button
            appearance="subtle"
            leading={<RiArrowGoBackLine />}
            onPress={() => handleReplyAll()}
          >
            {t('message.actions.replyAll')}
          </Button>
          <Button
            appearance="subtle"
            leading={<RiShareForwardLine />}
            onPress={() => handleForward()}
          >
            {t('message.actions.forward')}
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // `paddingLeft` / `paddingRight` are applied inline so they can include
  // landscape `insets.left` / `insets.right` (leading back button clips
  // under left notch otherwise).
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  labelPickerTitle: {
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  labelPickerEmpty: {
    fontSize: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingTop: 16,
  },
  contentPadded: {
    paddingHorizontal: 16,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  subject: {
    fontSize: 22,
    fontWeight: '400',
    lineHeight: 30,
    flex: 1,
  },
  labelChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  cardSection: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  highlightsSection: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 10,
    gap: 6,
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
  // Thread view styles
  threadCount: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  threadCountText: {
    fontSize: 12,
    fontWeight: '500',
  },
  threadSummaryPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  threadSummaryPromptText: {
    flex: 1,
    gap: 2,
  },
  threadSummaryPromptTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  threadSummaryPromptDescription: {
    fontSize: 12,
  },
  inlineReplyWrapper: {
    width: '100%',
  },
});
