import { useTranslation } from '@/lib/i18n';
import { presetsThatMakeSense } from '@/utils/timePresets';
import { Button } from '@oxy.so/bloom/button';
import { Text as BloomText } from '@oxy.so/bloom/typography';
/**
 * Schedule Send picker overlay.
 *
 * Shows preset schedule times (Later today, Tomorrow morning, Tomorrow afternoon,
 * Monday morning) and an option to pick a custom date.
 * Uses Bloom BottomSheet with gesture dismissal and animated transitions.
 */

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { BottomSheet, type BottomSheetRef } from '@oxy.so/bloom/bottom-sheet';
import { useCallback, useEffect, useRef } from 'react';
import { View } from 'react-native';

interface ScheduleOption {
  label: string;
  sublabel: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  getDate: () => Date;
}

function getScheduleOptions(): ScheduleOption[] {
  const now = new Date();

  // Later today: 3 hours from now (or 6 PM if < 3 PM)
  const laterToday = new Date(now);
  if (now.getHours() < 15) {
    laterToday.setHours(18, 0, 0, 0);
  } else {
    laterToday.setTime(laterToday.getTime() + 3 * 60 * 60 * 1000);
  }

  // Tomorrow morning: 8 AM
  const tomorrowMorning = new Date(now);
  tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
  tomorrowMorning.setHours(8, 0, 0, 0);

  // Tomorrow afternoon: 1 PM
  const tomorrowAfternoon = new Date(now);
  tomorrowAfternoon.setDate(tomorrowAfternoon.getDate() + 1);
  tomorrowAfternoon.setHours(13, 0, 0, 0);

  // Monday morning: next Monday 8 AM
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  const daysUntilMon = dayOfWeek === 1 ? 7 : (8 - dayOfWeek) % 7;
  monday.setDate(monday.getDate() + daysUntilMon);
  monday.setHours(8, 0, 0, 0);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const formatDay = (d: Date) =>
    d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

  const options: ScheduleOption[] = [
    {
      label: 'schedule.options.laterToday',
      sublabel: formatTime(laterToday),
      icon: 'weather-sunny',
      getDate: () => laterToday,
    },
    {
      label: 'schedule.options.tomorrowMorning',
      sublabel: `${formatDay(tomorrowMorning)}, ${formatTime(tomorrowMorning)}`,
      icon: 'weather-sunset-up',
      getDate: () => tomorrowMorning,
    },
    {
      label: 'schedule.options.tomorrowAfternoon',
      sublabel: `${formatDay(tomorrowAfternoon)}, ${formatTime(tomorrowAfternoon)}`,
      icon: 'weather-sunny',
      getDate: () => tomorrowAfternoon,
    },
    {
      label: 'schedule.options.mondayMorning',
      sublabel: `${formatDay(monday)}, ${formatTime(monday)}`,
      icon: 'calendar-arrow-right',
      getDate: () => monday,
    },
  ];
  return presetsThatMakeSense(options, now);
}

interface ScheduleSendSheetProps {
  visible: boolean;
  onClose: () => void;
  onSchedule: (date: Date) => void;
}

export function ScheduleSendSheet({
  visible,
  onClose,
  onSchedule,
}: ScheduleSendSheetProps) {
  const { t } = useTranslation();
  const options = getScheduleOptions();
  const sheetRef = useRef<BottomSheetRef>(null);

  useEffect(() => {
    if (visible) {
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible]);

  const handleSelect = useCallback(
    (option: ScheduleOption) => {
      onSchedule(option.getDate());
      onClose();
    },
    [onSchedule, onClose],
  );

  return (
    <BottomSheet ref={sheetRef} onDismiss={onClose} detached>
      <View className="gap-2 p-4">
        <BloomText variant="body-semibold">{t('schedule.title')}</BloomText>
        {options.map((option) => (
          <Button
            key={option.label}
            appearance="subtle"
            onPress={() => handleSelect(option)}
          >{`${t(option.label)} · ${option.sublabel}`}</Button>
        ))}
      </View>
    </BottomSheet>
  );
}
