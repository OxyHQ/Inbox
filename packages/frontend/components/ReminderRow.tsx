import { useTranslation, type TranslateFn } from '@/lib/i18n';
import { Button, IconButton } from '@oxy.so/bloom/button';
import { Checkbox } from '@oxy.so/bloom/checkbox';
import { RiDeleteBinLine } from '@oxy.so/bloom/icons';
import { Item } from '@oxy.so/bloom/item';
/**
 * Reminder row for the inbox list.
 *
 * Displays as a distinct item in the inbox list alongside email messages.
 * Shows reminder text, time, and completion toggle.
 */

import type { Reminder } from '@/services/emailApi';

interface ReminderRowProps {
  reminder: Reminder;
  onToggleComplete: (reminderId: string, completed: boolean) => void;
  onPress: (reminderId: string) => void;
  onDelete: (reminderId: string) => void;
}

/** Exported for tests. */
export function formatReminderTime(
  dateStr: string,
  t: TranslateFn,
  locale: string,
  now = new Date(),
): string {
  const date = new Date(dateStr);
  // Calendar days apart, counted on the calendar. Subtracting local midnights
  // and flooring was off by one across a DST change: the day after
  // spring-forward is 23 hours away, 0.96 of a day — "Today".
  const diffDays = Math.round(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) /
      86_400_000,
  );
  const time = date.toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
  });

  // Compared to the minute, not by day: a reminder due at 9 AM was still
  // "Today, 9:00 AM" at noon instead of overdue.
  if (date.getTime() < now.getTime())
    return t('time.overdueAt', {
      day: diffDays === 0 ? t('time.today') : date.toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
      time,
    });
  if (diffDays === 0) return t('time.todayAt', { time });
  if (diffDays === 1) return t('time.tomorrowAt', { time });
  return t('time.dayAt', {
    day: date.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' }),
    time,
  });
}

export function ReminderRow({
  reminder,
  onToggleComplete,
  onPress,
  onDelete,
}: ReminderRowProps) {
  const { t, locale } = useTranslation();
  return (
    <Item
      leading={
        <Checkbox
          checked={reminder.completed}
          accessibilityLabel={reminder.text}
          onCheckedChange={(next) => onToggleComplete(reminder._id, next)}
        />
      }
      title={
        <Button appearance="subtle" onPress={() => onPress(reminder._id)}>
          {reminder.text}
        </Button>
      }
      subtitle={
        reminder.remindAt ? formatReminderTime(reminder.remindAt, t, locale) : undefined
      }
      trailing={
        <IconButton
          accessibilityLabel={t('common.delete')}
          icon={<RiDeleteBinLine />}
          onPress={() => onDelete(reminder._id)}
        />
      }
    />
  );
}
