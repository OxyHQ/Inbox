/**
 * Keyboard shortcuts cheat-sheet modal.
 *
 * Surfaces the Gmail-style shortcuts already wired up in `useKeyboardShortcuts`.
 * Triggered by pressing `?` (Shift+/) anywhere outside an input.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Dialog, type DialogControlProps } from '@oxyhq/bloom';
import { Text } from '@oxyhq/bloom/typography';
import { useColors } from '@/constants/theme';
import { useTranslation } from '@/lib/i18n';

interface ShortcutRow {
  key: string;
  action: string;
}

interface KeyboardShortcutsHelpProps {
  control: DialogControlProps;
}

export function KeyboardShortcutsHelp({ control }: KeyboardShortcutsHelpProps) {
  const colors = useColors();
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
      <View style={styles.list}>
        {shortcuts.map((row) => (
          <View key={row.key} style={styles.row}>
            <View style={[styles.kbd, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.kbdLabel, { color: colors.text }]}>{row.key}</Text>
            </View>
            <Text style={[styles.action, { color: colors.text }]}>{row.action}</Text>
          </View>
        ))}
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: 8,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  kbd: {
    minWidth: 32,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kbdLabel: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  action: {
    fontSize: 14,
    flex: 1,
  },
});
