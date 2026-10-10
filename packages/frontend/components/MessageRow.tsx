import { Card, CardBody } from '@oxy.so/bloom/card';
import {
  RiArchiveLine,
  RiInbox2Line,
  RiCheckLine,
  RiDeleteBinLine,
  RiMailOpenLine,
  RiPushpinLine,
} from '@oxy.so/bloom/icons';
import { MailRow, type MailAction } from '@oxy.so/bloom/mail-list';
import { useTheme } from '@oxy.so/bloom/theme';
/** Bloom owns row layout, selection, hover actions and density on every platform. */

import { SPACING } from '@/constants/layout';
import { useColors } from '@/constants/theme';
import type { MessageDensity } from '@/contexts/inbox-prefs-context';
import type { SentimentResult } from '@/hooks/queries/useSentimentAnalysis';
import { useTranslation, type TranslateFn } from '@/lib/i18n';
import type { Attachment, Message } from '@/services/emailApi';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  Doc01Icon,
  File01Icon,
  FileZipIcon,
  Image01Icon,
  MusicNote01Icon,
  Pdf01Icon,
  PlayCircle02Icon,
  Ppt01Icon,
  Xls01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import { Chip } from '@oxy.so/bloom/chip';
import { Text } from '@oxy.so/bloom/typography';
import React from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { AttachmentThumbnail } from './AttachmentThumbnail';
import { CardPreview } from './cards/CardPreview';
import { ImportanceBadge } from './ImportanceBadge';
import { SentimentIndicator } from './SentimentIndicator';
import { calendarDaysBetween } from '@oxy.so/utils/date';
import { dateFormatter } from '@/utils/dateFormat';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.oxy.so';

/**
 * Row timestamp, scaled to how far back the message is: the closer it is, the
 * more precise the label. Today only needs a time; last week only needs a
 * weekday; older than that needs the date.
 *
 *   today      → 3:33 PM
 *   yesterday  → Yesterday
 *   < 7 days   → Sat
 *   this year  → Jul 22
 *   older      → Jul 22, 24
 */
const TIME: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
const WEEKDAY: Intl.DateTimeFormatOptions = { weekday: 'short' };
const MONTH_DAY: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
const MONTH_DAY_YEAR: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: '2-digit' };
const WEEKDAY_MONTH_DAY: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };

function formatDate(dateStr: string, yesterdayLabel: string, locale: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = calendarDaysBetween(date, now);

  if (diffDays === 0) return dateFormatter(locale, TIME).format(date);
  if (diffDays === 1) return yesterdayLabel;
  if (diffDays < 7) return dateFormatter(locale, WEEKDAY).format(date);

  if (date.getFullYear() === now.getFullYear()) {
    return dateFormatter(locale, MONTH_DAY).format(date);
  }
  return dateFormatter(locale, MONTH_DAY_YEAR).format(date);
}

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
    return recipients
      ? t('message.draftTo', { recipients })
      : t('message.draftLabel');
  }
  return displayName(message.from);
}

function getPreview(message: Message): string {
  const text = message.text || '';
  return text.replace(/\s+/g, ' ').trim().substring(0, 120);
}

type AttachmentInfo = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  hugeIcon: IconSvgElement;
  label: string;
  color: string;
};

function getAttachmentInfo(
  att: Attachment,
  tokens: ReturnType<typeof useTheme>['colors'],
): AttachmentInfo {
  const ct = att.contentType.toLowerCase();
  if (ct.startsWith('image/'))
    return {
      icon: 'image-outline',
      hugeIcon: Image01Icon as unknown as IconSvgElement,
      label: att.name,
      color: tokens.successSubtleForeground,
    };
  if (ct.startsWith('video/'))
    return {
      icon: 'play-circle-outline',
      hugeIcon: PlayCircle02Icon as unknown as IconSvgElement,
      label: att.name,
      color: tokens.errorSubtleForeground,
    };
  if (ct.startsWith('audio/'))
    return {
      icon: 'music-note-outline',
      hugeIcon: MusicNote01Icon as unknown as IconSvgElement,
      label: att.name,
      color: tokens.tertiarySubtleForeground,
    };
  if (ct.includes('pdf'))
    return {
      icon: 'file-pdf-box',
      hugeIcon: Pdf01Icon as unknown as IconSvgElement,
      label: att.name,
      color: tokens.errorSubtleForeground,
    };
  if (ct.includes('spreadsheet') || ct.includes('excel') || ct.includes('csv'))
    return {
      icon: 'file-excel-outline',
      hugeIcon: Xls01Icon as unknown as IconSvgElement,
      label: att.name,
      color: tokens.successSubtleForeground,
    };
  if (ct.includes('presentation') || ct.includes('powerpoint'))
    return {
      icon: 'file-powerpoint-outline',
      hugeIcon: Ppt01Icon as unknown as IconSvgElement,
      label: att.name,
      color: tokens.warningSubtleForeground,
    };
  if (ct.includes('document') || ct.includes('word') || ct.includes('msword'))
    return {
      icon: 'file-word-outline',
      hugeIcon: Doc01Icon as unknown as IconSvgElement,
      label: att.name,
      color: tokens.infoSubtleForeground,
    };
  if (
    ct.includes('zip') ||
    ct.includes('rar') ||
    ct.includes('tar') ||
    ct.includes('gz')
  )
    return {
      icon: 'zip-box-outline',
      hugeIcon: FileZipIcon as unknown as IconSvgElement,
      label: att.name,
      color: tokens.textSecondary,
    };
  return {
    icon: 'file-outline',
    hugeIcon: File01Icon as unknown as IconSvgElement,
    label: att.name,
    color: tokens.textSecondary,
  };
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
}: MessageRowProps) {
  const { t, locale } = useTranslation();
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
      label: t(
        message.flags.seen
          ? 'message.actions.markUnread'
          : 'selection.markRead',
      ),
      onPress: () => onToggleRead(message._id, !message.flags.seen),
    });
  if (onPin && !isPinPending)
    actions.push({
      key: 'pin',
      icon: RiPushpinLine,
      label: t(
        message.flags.pinned ? 'message.actions.unpin' : 'message.actions.pin',
      ),
      onPress: () => onPin(message._id),
    });
  return (
    <MailRow
      sender={{
        name: getSenderName(message, t),
        avatar: message.senderAvatarPath
          ? `${API_URL}${message.senderAvatarPath}`
          : undefined,
      }}
      subject={message.subject || t('message.detail.noSubject')}
      snippet={showPreviews ? getPreview(message) : undefined}
      time={
        showSnoozeTime && message.snoozedUntil
          ? formatSnoozeTime(message.snoozedUntil, t, locale)
          : formatDate(message.date, t('inbox.sections.yesterday'), locale)
      }
      unread={!message.flags.seen}
      starred={message.flags.starred}
      threadCount={message.threadCount ?? undefined}
      hasAttachment={message.attachments.length > 0}
      selected={isSelected}
      checked={!!isMultiSelected}
      onCheckedChange={
        isSelectionMode && onToggleSelect
          ? () => onToggleSelect(message._id)
          : undefined
      }
      onPress={() =>
        isSelectionMode && onToggleSelect
          ? onToggleSelect(message._id)
          : onSelect(message)
      }
      onLongPress={onLongPress ? () => onLongPress(message._id) : undefined}
      density={density}
      actions={isSelectionMode ? [] : actions}
      swipeEnabled={false}
      strings={{
        star: t('selection.star'),
        select: t('selection.select'),
        attachment: t('search.filters.hasAttachment'),
        starred: t('drawer.starred'),
        threadCount: (count) =>
          t('ui.message.conversationMessages', { count }),
        unread: t('message.unreadState'),
      }}
    />
  );
}

/**
 * Everything a message can carry beyond the single line — labels, card
 * preview, attachment thumbnails. Rendered by the list under the row so the
 * row itself stays exactly one line tall.
 */
function MessageRowExtrasInner({
  message,
  sentiment,
}: {
  message: Message;
  sentiment?: SentimentResult | null;
}) {
  const colors = useColors();
  const { colors: tokens } = useTheme();
  const hasAttachments = message.attachments.length > 0;
  const hasChips = message.labels.length > 0 || Boolean(sentiment);

  if (!hasChips && !message.card && !hasAttachments) return null;

  return (
    <View style={styles.extras}>
      {/* Chip row: importance, sentiment and labels all live on this second
            line so the message line itself stays a single uninterrupted row. */}
      {hasChips && (
        <View style={styles.labelChipRow}>
          <ImportanceBadge message={message} />
          <SentimentIndicator sentiment={sentiment ?? null} size="small" />
          {message.labels.slice(0, 3).map((labelName) => {
            return (
              <Chip key={labelName} variant="subtle">
                {labelName}
              </Chip>
            );
          })}
          {message.labels.length > 3 && (
            <Text
              style={[styles.moreLabelText, { color: colors.secondaryText }]}
            >
              +{message.labels.length - 3}
            </Text>
          )}
        </View>
      )}

      {/* One horizontal rail of cards, Inbox-by-Gmail style: the extracted
            smart card (flight, order, event, bill, package) leads, then a card
            per attachment. Scrolls sideways instead of stacking rows, so a
            message with a flight and four files still costs one row of height. */}
      {(message.card || hasAttachments) && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardRail}
        >
          {message.card && <CardPreview card={message.card} />}

          {message.attachments.map((att, i) => {
            const isImage = att.contentType.toLowerCase().startsWith('image/');
            const info = getAttachmentInfo(att, tokens);
            return (
              <Card key={att.fileId || i} appearance="outline">
                <CardBody>
                  <View className="flex-row items-center gap-2">
                    {isImage ? (
                      <AttachmentThumbnail fileId={att.fileId} size={40} />
                    ) : Platform.OS === 'web' ? (
                      <HugeiconsIcon
                        icon={info.hugeIcon}
                        size={20}
                        color={info.color}
                      />
                    ) : (
                      <MaterialCommunityIcons
                        name={info.icon}
                        size={20}
                        color={info.color}
                      />
                    )}
                    <Text
                      style={[
                        styles.railCardLabel,
                        { color: colors.secondaryText },
                      ]}
                      numberOfLines={1}
                    >
                      {info.label}
                    </Text>
                  </View>
                </CardBody>
              </Card>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

export const MessageRow = React.memo(MessageRowInner);

const styles = StyleSheet.create({
  cardRail: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingRight: SPACING.lg,
  },
  railCardLabel: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '500',
  },
  extras: {
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  labelChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  moreLabelText: {
    fontSize: 10,
  },
});

/**
 * Memoized for the same reason `MessageRow` is: it renders beside one for every
 * row, and the list re-renders mounted items on each selection toggle
 * (`extraData`). Without this, the row's comparator only halves the work.
 */
export const MessageRowExtras = React.memo(MessageRowExtrasInner);
