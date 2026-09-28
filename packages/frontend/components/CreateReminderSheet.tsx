import { useTranslation } from '@/lib/i18n';
import { BottomSheet, type BottomSheetRef } from '@oxy.so/bloom/bottom-sheet';
import { Button, IconButton } from '@oxy.so/bloom/button';
import { RiCloseLine } from '@oxy.so/bloom/icons';
import { TextFieldInput } from '@oxy.so/bloom/text-field';
import { Text } from '@oxy.so/bloom/typography';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

interface CreateReminderSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (text: string, remindAt: Date) => void;
  relatedMessageId?: string;
  /**
   * When provided, the sheet operates in edit mode: fields are prefilled and
   * submission calls `onUpdate` instead of `onCreate`.
   */
  editReminder?: { _id: string; text: string; remindAt: string } | null;
  onUpdate?: (text: string, remindAt: Date) => void;
}

interface ReminderDraft {
  key: string;
  text: string;
  selectedTime: Date | null;
}

function getReminderDraftKey(
  visible: boolean,
  editReminder: CreateReminderSheetProps['editReminder'],
): string {
  if (!editReminder) return `${visible ? 'open' : 'closed'}:create`;
  return `${visible ? 'open' : 'closed'}:${editReminder._id}:${editReminder.text}:${editReminder.remindAt}`;
}

function getReminderDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function createReminderDraft(
  key: string,
  editReminder: CreateReminderSheetProps['editReminder'],
): ReminderDraft {
  return {
    key,
    text: editReminder?.text ?? '',
    selectedTime: getReminderDate(editReminder?.remindAt),
  };
}

function getPresetTimes(): { label: string; date: Date }[] {
  const now = new Date();
  const presets: { label: string; date: Date }[] = [];

  // Later today (6 PM or +3h)
  const laterToday = new Date(now);
  laterToday.setHours(Math.max(now.getHours() + 3, 18), 0, 0, 0);
  if (laterToday.getDate() === now.getDate()) {
    presets.push({
      label: 'reminder.create.presets.laterToday',
      date: laterToday,
    });
  }

  // Tomorrow 9 AM
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  presets.push({
    label: 'reminder.create.presets.tomorrowMorning',
    date: tomorrow,
  });

  // This weekend (Saturday 9 AM)
  const saturday = new Date(now);
  saturday.setDate(saturday.getDate() + ((6 - saturday.getDay() + 7) % 7 || 7));
  saturday.setHours(9, 0, 0, 0);
  if (saturday > now) {
    presets.push({
      label: 'reminder.create.presets.thisWeekend',
      date: saturday,
    });
  }

  // Next week (Monday 9 AM)
  const monday = new Date(now);
  monday.setDate(monday.getDate() + ((1 - monday.getDay() + 7) % 7 || 7));
  monday.setHours(9, 0, 0, 0);
  presets.push({ label: 'reminder.create.presets.nextWeek', date: monday });

  return presets;
}

export function CreateReminderSheet({
  visible,
  onClose,
  onCreate,
  editReminder,
  onUpdate,
}: CreateReminderSheetProps) {
  const { t } = useTranslation();
  const isEdit = !!editReminder;
  const sheetRef = useRef<BottomSheetRef>(null);

  const presets = useMemo(() => (visible ? getPresetTimes() : []), [visible]);
  const draftKey = useMemo(
    () => getReminderDraftKey(visible, editReminder),
    [visible, editReminder],
  );
  const initialDraft = useMemo(
    () => createReminderDraft(draftKey, editReminder),
    [draftKey, editReminder],
  );
  const [storedDraft, setStoredDraft] = useState<ReminderDraft>(
    () => initialDraft,
  );
  const draft = storedDraft.key === draftKey ? storedDraft : initialDraft;

  useEffect(() => {
    if (visible) {
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible]);

  const handleTextChange = useCallback(
    (nextText: string) => {
      setStoredDraft((previous) => ({
        key: draftKey,
        text: nextText,
        selectedTime:
          previous.key === draftKey
            ? previous.selectedTime
            : initialDraft.selectedTime,
      }));
    },
    [draftKey, initialDraft.selectedTime],
  );

  const handleTimeChange = useCallback(
    (nextTime: Date) => {
      setStoredDraft((previous) => ({
        key: draftKey,
        text: previous.key === draftKey ? previous.text : initialDraft.text,
        selectedTime: nextTime,
      }));
    },
    [draftKey, initialDraft.text],
  );

  const handleSubmit = useCallback(() => {
    if (!draft.text.trim() || !draft.selectedTime) return;
    if (isEdit) {
      onUpdate?.(draft.text.trim(), draft.selectedTime);
    } else {
      onCreate(draft.text.trim(), draft.selectedTime);
    }
    setStoredDraft({ key: draftKey, text: '', selectedTime: null });
  }, [draft, draftKey, isEdit, onUpdate, onCreate]);

  const handleClose = useCallback(() => {
    setStoredDraft({ key: draftKey, text: '', selectedTime: null });
    onClose();
  }, [draftKey, onClose]);

  const canSubmit = draft.text.trim().length > 0 && draft.selectedTime !== null;

  return (
    <BottomSheet ref={sheetRef} onDismiss={handleClose} detached>
      <View className="gap-4 p-5">
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <Text variant="body-semibold">
              {isEdit ? t('common.edit') : t('reminder.create.title')}
            </Text>
          </View>
          <IconButton
            icon={<RiCloseLine />}
            accessibilityLabel={t('common.close')}
            onPress={handleClose}
          />
        </View>
        <TextFieldInput
          label={t('reminder.create.placeholder')}
          placeholder={t('reminder.create.placeholder')}
          value={draft.text}
          onChangeText={handleTextChange}
          multiline
          maxLength={500}
          autoFocus
        />
        <Text variant="body-semibold">{t('reminder.create.whenLabel')}</Text>
        <View className="gap-2">
          {presets.map((preset) => {
            const isSelected =
              draft.selectedTime?.getTime() === preset.date.getTime();
            return (
              <Button
                key={preset.label}
                appearance={isSelected ? 'subtle' : 'outline'}
                tone={isSelected ? 'accent' : 'neutral'}
                pressed={isSelected}
                onPress={() => handleTimeChange(preset.date)}
              >
                {`${t(preset.label)} · ${preset.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`}
              </Button>
            );
          })}
        </View>
        <Button onPress={handleSubmit} disabled={!canSubmit}>
          {isEdit ? t('common.save') : t('reminder.create.submit')}
        </Button>
      </View>
    </BottomSheet>
  );
}
