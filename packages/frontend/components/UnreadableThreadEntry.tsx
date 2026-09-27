/**
 * A message in a conversation that this client could not read. It keeps its
 * place in the thread, says so, and offers the two ways forward: read the
 * conversation again, or open the message's raw source.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '@/constants/theme';
import { SPACING } from '@/constants/layout';
import { useTranslation } from '@/lib/i18n';
import type { UnreadableMessage } from '@/services/emailApi';

interface UnreadableThreadEntryProps {
  row: UnreadableMessage;
  onRetry: () => void;
  onOpenRaw?: (messageId: string) => void;
}

export function UnreadableThreadEntry({ row, onRetry, onOpenRaw }: UnreadableThreadEntryProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const id = row._id;
  const detail = [row.from, row.subject].filter(Boolean).join(' · ');

  return (
    <View
      accessibilityRole="alert"
      style={[styles.entry, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Text style={[styles.title, { color: colors.text }]}>{t('inbox.unreadable.title')}</Text>
      {detail ? (
        <Text numberOfLines={1} style={[styles.detail, { color: colors.secondaryText }]}>
          {detail}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={onRetry}>
          <Text style={[styles.action, { color: colors.primary }]}>{t('inbox.unreadable.retry')}</Text>
        </Pressable>
        {id && onOpenRaw ? (
          <Pressable accessibilityRole="button" onPress={() => onOpenRaw(id)}>
            <Text style={[styles.action, { color: colors.primary }]}>{t('inbox.unreadable.openRaw')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  entry: {
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  detail: {
    fontSize: 13,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  action: {
    fontSize: 14,
    fontWeight: '600',
  },
});
