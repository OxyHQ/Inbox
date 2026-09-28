import { useTranslation } from '@/lib/i18n';
import { Button } from '@oxy.so/bloom/button';
import { Text as BloomText } from '@oxy.so/bloom/typography';
/**
 * Snooze picker overlay.
 *
 * Shows preset snooze times (Later today, Tomorrow, This weekend, Next week)
 * and an option to pick a custom date. Uses Bloom BottomSheet with gesture
 * dismissal and animated transitions.
 */

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { BottomSheet, type BottomSheetRef } from '@oxy.so/bloom/bottom-sheet';
import { useCallback, useEffect, useRef } from 'react';
import { View } from 'react-native';

interface SnoozeOption {
  label: string;
  sublabel: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  getDate: () => Date;
}

function getSnoozeOptions(): SnoozeOption[] {
  const now = new Date();

  // Later today: 3 hours from now (or 6 PM if < 3 PM)
  const laterToday = new Date(now);
  if (now.getHours() < 15) {
    laterToday.setHours(18, 0, 0, 0);
  } else {
    laterToday.setTime(laterToday.getTime() + 3 * 60 * 60 * 1000);
  }

  // Tomorrow morning: 9 AM
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  // This weekend: Saturday 9 AM
  const saturday = new Date(now);
  const dayOfWeek = saturday.getDay();
  const daysUntilSat = dayOfWeek === 6 ? 7 : 6 - dayOfWeek;
  saturday.setDate(saturday.getDate() + daysUntilSat);
  saturday.setHours(9, 0, 0, 0);

  // Next week: Monday 9 AM
  const monday = new Date(now);
  const daysUntilMon = dayOfWeek === 1 ? 7 : (8 - dayOfWeek) % 7;
  monday.setDate(monday.getDate() + daysUntilMon);
  monday.setHours(9, 0, 0, 0);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const formatDay = (d: Date) =>
    d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

  return [
    {
      label: 'snooze.options.laterToday',
      sublabel: formatTime(laterToday),
      icon: 'weather-sunny',
      getDate: () => laterToday,
    },
    {
      label: 'snooze.options.tomorrow',
      sublabel: `${formatDay(tomorrow)}, ${formatTime(tomorrow)}`,
      icon: 'weather-night',
      getDate: () => tomorrow,
    },
    {
      label: 'snooze.options.thisWeekend',
      sublabel: `${formatDay(saturday)}, ${formatTime(saturday)}`,
      icon: 'sofa-outline',
      getDate: () => saturday,
    },
    {
      label: 'snooze.options.nextWeek',
      sublabel: `${formatDay(monday)}, ${formatTime(monday)}`,
      icon: 'calendar-arrow-right',
      getDate: () => monday,
    },
  ];
}

interface SnoozeSheetProps {
  visible: boolean;
  onClose: () => void;
  onSnooze: (until: Date) => void;
}

export function SnoozeSheet({ visible, onClose, onSnooze }: SnoozeSheetProps) {
  const { t } = useTranslation();
  const options = getSnoozeOptions();
  const sheetRef = useRef<BottomSheetRef>(null);

  useEffect(() => {
    if (visible) {
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible]);

  const handleSelect = useCallback(
    (option: SnoozeOption) => {
      onSnooze(option.getDate());
      onClose();
    },
    [onSnooze, onClose],
  );

  return (
    <BottomSheet ref={sheetRef} onDismiss={onClose} detached>
      <View className="gap-2 p-4">
        <BloomText variant="body-semibold">{t('snooze.title')}</BloomText>
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
