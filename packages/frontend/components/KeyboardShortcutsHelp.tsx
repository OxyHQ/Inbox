/**
 * Keyboard shortcuts cheat-sheet modal.
 *
 * Surfaces the Gmail-style shortcuts already wired up in `useKeyboardShortcuts`.
 * Triggered by pressing `?` (Shift+/) anywhere outside an input.
 */

import React from 'react';
import { View } from 'react-native';
import { Kbd } from '@oxy.so/bloom/kbd';
import { Dialog, type DialogControlProps } from '@oxy.so/bloom';
import { Text } from '@oxy.so/bloom/typography';
import { useTranslation } from '@/lib/i18n';

interface ShortcutRow {
  key: string;
  action: string;
}

interface KeyboardShortcutsHelpProps {
  control: DialogControlProps;
}

export function KeyboardShortcutsHelp({ control }: KeyboardShortcutsHelpProps) {
  const { t } = useTranslation();
  const shortcuts: ShortcutRow[] = [
    { key: 'c', action: t('shortcuts.actions.compose') },
    { key: 'r', action: t('shortcuts.actions.reply') },
    { key: 'a', action: t('shortcuts.actions.replyAll') },
    { key: 'f', action: t('shortcuts.actions.forward') },
    { key: 'e', action: t('shortcuts.actions.archive') },
    { key: '#', action: t('shortcuts.actions.delete') },
    { key: 'j', action: t('shortcuts.actions.nextMessage') },
    { key: 'k', action: t('shortcuts.actions.previousMessage') },
    { key: 's', action: t('shortcuts.actions.starUnstar') },
    { key: 'u', action: t('shortcuts.actions.markUnread') },
    { key: '/', action: t('shortcuts.actions.search') },
    { key: '?', action: t('shortcuts.actions.help') },
  ];

  return (
    <Dialog
      control={control}
      testID="keyboard-shortcuts-help"
      title={t('shortcuts.title')}
      actions={[{ label: t('shortcuts.close'), color: 'cancel' }]}
    >
      <View className="gap-2">
        {shortcuts.map((row) => (
          <View key={row.key} className="flex-row items-center gap-3">
            <Kbd>{row.key}</Kbd>
            <Text className="flex-1">{row.action}</Text>
          </View>
        ))}
      </View>
    </Dialog>
  );
}
