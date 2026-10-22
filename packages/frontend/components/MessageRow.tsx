import { RiArchiveLine } from '@oxy.so/bloom/icons/RiArchiveLine';
import { RiInbox2Line } from '@oxy.so/bloom/icons/RiInbox2Line';
import { RiCheckLine } from '@oxy.so/bloom/icons/RiCheckLine';
import { RiDeleteBinLine } from '@oxy.so/bloom/icons/RiDeleteBinLine';
import { RiMailOpenLine } from '@oxy.so/bloom/icons/RiMailOpenLine';
import { RiPushpinLine } from '@oxy.so/bloom/icons/RiPushpinLine';
import { RiPriceTag3Line } from '@oxy.so/bloom/icons/RiPriceTag3Line';
import { MailRow, type MailAction } from '@oxy.so/bloom/mail-list';
import { useTheme } from '@oxy.so/bloom/theme';
/** Bloom owns row layout, selection, hover actions and density on every platform. */

import { SPACING } from '@/constants/layout';
import type { MessageDensity } from '@/contexts/inbox-prefs-context';
import type { SentimentResult } from '@/hooks/queries/useSentimentAnalysis';
import { useTranslation, type TranslateFn } from '@/lib/i18n';
import type { Message } from '@/services/emailApi';
import { Chip } from '@oxy.so/bloom/chip';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useLabels } from '@/hooks/queries/useLabels';
import { AttachmentPreview } from './AttachmentPreview';
import { CardPreview } from './cards/CardPreview';
import { ImportanceBadge } from './ImportanceBadge';
import { SentimentIndicator } from './SentimentIndicator';
import { calendarDaysBetween } from '@oxy.so/utils/date';
import { dateFormatter, formatRowTime } from '@/utils/dateFormat';
import { useDeliveryLabel } from '@/components/DeliveryStatus';
import { deliveryTone, isOutstanding } from '@/utils/delivery';

const TIME: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
const WEEKDAY_MONTH_DAY: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
};

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.oxy.so';

function displayName(address: { name?: string | null; address: string }): string {
  if (address.name) return address.name;
  return address.address.split('@')[0];
}

/**
 * Who a row names. A draft's sender is always the user, so a list of drafts
 * named only them, row after row; it names who the draft is going to instead.
 */
function getSenderName(message: Message, t: TranslateFn): string {
  if (message.flags.draft) {
    const recipients = [...message.to, ...message.cc].map(displayName).join(', ');
    return recipients ? t('message.draftTo', { recipients }) : t('message.draftLabel');
  }
  return displayName(message.from);
}

function getPreview(message: Message): string {
  const text = message.text || '';
  return text.replace(/\s+/g, ' ').trim().substring(0, 120);
}

function formatSnoozeTime(dateStr: string, t: TranslateFn, locale: string): string {
  const date = new Date(dateStr);
  const diffDays = calendarDaysBetween(new Date(), date);
  const time = dateFormatter(locale, TIME).format(date);

  if (diffDays === 0) return t('time.todayAt', { time });
  if (diffDays === 1) return t('time.tomorrowAt', { time });
  return t('time.dayAt', { day: dateFormatter(locale, WEEKDAY_MONTH_DAY).format(date), time });
}

interface MessageRowProps {
  message: Message;
  onPin?: (id: string) => void;
  /** Gets the whole message: where it opens depends on it (a draft opens in the composer). */
  onSelect: (message: Message) => void;
  onArchive?: (id: string) => void;
  /** In Archive: the archive action moves the row back to the Inbox. */
  archived?: boolean;
  onDelete?: (id: string) => void;
  onToggleRead?: (id: string, seen: boolean) => void;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  isMultiSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onLongPress?: (id: string) => void;
  isPinPending?: boolean;
  showSnoozeTime?: boolean;
  density?: MessageDensity;
  showPreviews?: boolean;
  sentiment?: SentimentResult | null;
  snippetOverride?: string;
}

function MessageRowInner({
  message,
  onPin,
  onSelect,
  onArchive,
  onDelete,
  onToggleRead,
  isSelected,
  isSelectionMode,
  isMultiSelected,
  onToggleSelect,
  onLongPress,
  isPinPending,
  showSnoozeTime,
  density = 'comfortable',
  showPreviews = true,
  archived = false,
  sentiment,
  snippetOverride,
}: MessageRowProps) {
  const { t, locale } = useTranslation();
  const deliveryLabel = useDeliveryLabel();
  const actions: MailAction[] = [];
  if (onToggleSelect)
    actions.push({
      key: 'select',
      icon: RiCheckLine,
      label: t('selection.select'),
      onPress: () => onToggleSelect(message._id),
    });
  if (onArchive)
    actions.push({
      key: 'archive',
      icon: archived ? RiInbox2Line : RiArchiveLine,
      label: t(archived ? 'message.actions.moveToInbox' : 'selection.archive'),
      onPress: () => onArchive(message._id),
    });
  if (onDelete)
    actions.push({
      key: 'delete',
      icon: RiDeleteBinLine,
      tone: 'negative',
      label: t('selection.delete'),
      onPress: () => onDelete(message._id),
    });
  if (onToggleRead)
    actions.push({
      key: 'read',
      icon: RiMailOpenLine,
      label: t(message.flags.seen ? 'message.actions.markUnread' : 'selection.markRead'),
      onPress: () => onToggleRead(message._id, !message.flags.seen),
    });
  if (onPin && !isPinPending)
    actions.push({
      key: 'pin',
      icon: RiPushpinLine,
      label: t(message.flags.pinned ? 'message.actions.unpin' : 'message.actions.pin'),
      onPress: () => onPin(message._id),
    });
  return (
    <MailRow
      sender={{
        name: getSenderName(message, t),
        avatar: message.senderAvatarPath ? `${API_URL}${message.senderAvatarPath}` : undefined,
      }}
      subject={message.subject || t('message.detail.noSubject')}
      snippet={showPreviews ? (snippetOverride ?? getPreview(message)) : undefined}
      time={
        showSnoozeTime && message.snoozedUntil
          ? formatSnoozeTime(message.snoozedUntil, t, locale)
          : formatRowTime(message.date, t('inbox.sections.yesterday'), locale)
      }
      // A sent message that has not left says so on the row — the one place a
      // glance at Sent always lands. Delivered mail and received mail carry
      // no delivery chip.
      labels={
        isOutstanding(message.delivery)
          ? [
              {
                id: 'delivery',
                name: deliveryLabel(message.delivery),
                tone: deliveryTone(message.delivery),
              },
            ]
          : undefined
      }
      unread={!message.flags.seen}
      starred={message.flags.starred}
      threadCount={message.threadCount ?? undefined}
      hasAttachment={fileAttachments(message).length > 0}
      selected={isSelected}
      checked={!!isMultiSelected}
      onCheckedChange={
        isSelectionMode && onToggleSelect ? () => onToggleSelect(message._id) : undefined
      }
      onPress={() =>
        isSelectionMode && onToggleSelect ? onToggleSelect(message._id) : onSelect(message)
      }
      onLongPress={onLongPress ? () => onLongPress(message._id) : undefined}
      density={density}
      actions={isSelectionMode ? [] : actions}
      swipeEnabled={false}
      footer={
        message.labels.length > 0 || sentiment ? (
          <MessageRowExtras message={message} sentiment={sentiment} />
        ) : undefined
      }
      attachments={
        message.card || fileAttachments(message).length > 0 ? (
          <MessageAttachments message={message} disabled={isSelectionMode} />
        ) : undefined
      }
      strings={{
        star: t('selection.star'),
        select: t('selection.select'),
        attachment: t('search.filters.hasAttachment'),
        starred: t('drawer.starred'),
        threadCount: (count) => t('ui.message.conversationMessages', { count }),
        unread: t('message.unreadState'),
      }}
    />
  );
}

/** Labels stay with the text; Bloom owns the separate full-width attachment viewport. */
function MessageRowExtras({
  message,
  sentiment,
}: {
  message: Message;
  sentiment?: SentimentResult | null;
}) {
  const { data: labels = [] } = useLabels();
  const { colors } = useTheme();
  return (
    <View style={styles.labelChipRow}>
      <ImportanceBadge message={message} />
      <SentimentIndicator sentiment={sentiment ?? null} size="small" />
      {message.labels.map((name) => (
        <Chip
          key={name}
          variant="subtle"
          size="sm"
          leading={
            <RiPriceTag3Line
              width={12}
              height={12}
              fill={labels.find((label) => label.name === name)?.color || colors.textSecondary}
            />
          }
        >
          {name}
        </Chip>
      ))}
    </View>
  );
}

function MessageAttachments({ message, disabled }: { message: Message; disabled?: boolean }) {
  return (
    <>
      {message.card && <CardPreview card={message.card} />}
      {fileAttachments(message).map((attachment, index) => (
        <AttachmentPreview
          key={attachment.fileId || index}
          attachment={attachment}
          disabled={disabled}
        />
      ))}
    </>
  );
}

export const MessageRow = React.memo(MessageRowInner);

const styles = StyleSheet.create({
  labelChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: SPACING.xs,
  },
});

/** Inline body images are not separate file attachments. */
function fileAttachments(message: Message): Message['attachments'] {
  return message.attachments.filter((attachment) => !(attachment.isInline && attachment.contentId));
}
