import {
  RiArchiveLine,
  RiCheckLine,
  RiDeleteBinLine,
  RiMailOpenLine,
  RiPushpinLine,
} from '@oxy.so/bloom/icons';
import { MailRow, type MailAction } from '@oxy.so/bloom/mail-list';
import { useTheme } from '@oxy.so/bloom/theme';
/** Bloom owns row layout, selection, hover actions and density on every platform. */

import { RADIUS, SPACING } from '@/constants/layout';
import { useColors } from '@/constants/theme';
import type { MessageDensity } from '@/contexts/inbox-prefs-context';
import type { SentimentResult } from '@/hooks/queries/useSentimentAnalysis';
import { useTranslation } from '@/lib/i18n';
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
/**
 * Built once and reused. `toLocaleTimeString(undefined, {...})` constructs a
 * new `Intl.DateTimeFormat` on every call — the options path defeats the
 * engine's format cache — and a list mounts one row per message.
 */
const TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});
const WEEKDAY_FORMAT = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const MONTH_DAY_FORMAT = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
});
const MONTH_DAY_YEAR_FORMAT = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: '2-digit',
});
const WEEKDAY_MONTH_DAY_FORMAT = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

function formatDate(dateStr: string, yesterdayLabel: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor(
    (today.getTime() - msgDay.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) {
    return TIME_FORMAT.format(date);
  }
  if (diffDays === 1) return yesterdayLabel;
  if (diffDays < 7) return WEEKDAY_FORMAT.format(date);

  if (date.getFullYear() === now.getFullYear()) {
    return MONTH_DAY_FORMAT.format(date);
  }
  return MONTH_DAY_YEAR_FORMAT.format(date);
}

function getSenderName(message: Message): string {
  if (message.from.name) return message.from.name;
  return message.from.address.split('@')[0];
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

function formatSnoozeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const snoozeDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const diffDays = Math.floor(
    (snoozeDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  const time = TIME_FORMAT.format(date);

  if (diffDays === 0) return `Today, ${time}`;
  if (diffDays === 1) return `Tomorrow, ${time}`;
  return `${WEEKDAY_MONTH_DAY_FORMAT.format(date)}, ${time}`;
}

interface MessageRowProps {
  message: Message;
  onPin?: (id: string) => void;
  onSelect: (id: string) => void;
  onArchive?: (id: string) => void;
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
  showAvatars?: boolean;
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
  showAvatars = true,
  showPreviews = true,
}: MessageRowProps) {
  const { t } = useTranslation();
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
      icon: RiArchiveLine,
      label: t('selection.archive'),
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
        name: getSenderName(message),
        avatar: message.senderAvatarPath
          ? `${API_URL}${message.senderAvatarPath}`
          : undefined,
      }}
      subject={message.subject || t('message.detail.noSubject')}
      snippet={showPreviews ? getPreview(message) : undefined}
      time={
        showSnoozeTime && message.snoozedUntil
          ? formatSnoozeTime(message.snoozedUntil)
          : formatDate(message.date, t('inbox.sections.yesterday'))
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
          : onSelect(message._id)
      }
      onLongPress={onLongPress ? () => onLongPress(message._id) : undefined}
      density={density}
      showAvatar={showAvatars}
      actions={isSelectionMode ? [] : actions}
      swipeEnabled={false}
      strings={{
        star: t('selection.star'),
        select: t('selection.select'),
        attachment: t('search.filters.hasAttachment'),
        starred: t('drawer.starred'),
        threadCount: (count) =>
          t(
            count === 1
              ? 'ui.message.conversationMessages_one'
              : 'ui.message.conversationMessages_other',
            { count },
          ),
        unread: t('message.actions.markUnread'),
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
              <Chip key={labelName} variant="subtle" size="small">
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
          {message.card && (
            <View
              style={[
                styles.railCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <CardPreview card={message.card} />
            </View>
          )}

          {message.attachments.map((att, i) => {
            const isImage = att.contentType.toLowerCase().startsWith('image/');
            const info = getAttachmentInfo(att, tokens);
            return (
              <View
                key={att.fileId || i}
                style={[
                  styles.railCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
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
  railCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    maxWidth: 220,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.row,
    borderWidth: StyleSheet.hairlineWidth,
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
