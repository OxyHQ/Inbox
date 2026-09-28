import { useTranslation } from '@/lib/i18n';
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

function formatReminderTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const reminderDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const diffDays = Math.floor(
    (reminderDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  const time = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (diffDays < 0)
    return `Overdue · ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${time}`;
  if (diffDays === 0) return `Today, ${time}`;
  if (diffDays === 1) return `Tomorrow, ${time}`;
  return `${date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}, ${time}`;
}

export function ReminderRow({
  reminder,
  onToggleComplete,
  onPress,
  onDelete,
}: ReminderRowProps) {
  const { t } = useTranslation();
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
        reminder.remindAt ? formatReminderTime(reminder.remindAt) : undefined
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
