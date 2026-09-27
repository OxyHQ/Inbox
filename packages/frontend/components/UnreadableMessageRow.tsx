/**
 * A list row for a message the API returned but this client could not read.
 *
 * It exists so a message never silently disappears: before it, a row that
 * failed the schema was dropped, and a Ramp verification code showed for a
 * second and then vanished. It says what little is known and offers to open
 * the message, where the detail screen reports the failure itself.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '@/constants/theme';
import { SPACING } from '@/constants/layout';
import { useTranslation } from '@/lib/i18n';
import type { UnreadableMessage } from '@/services/emailApi';

interface UnreadableMessageRowProps {
  message: UnreadableMessage;
  onOpen?: (messageId: string) => void;
}

export function UnreadableMessageRow({ message, onOpen }: UnreadableMessageRowProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const id = message._id;
  const canOpen = Boolean(id && onOpen);
  const detail = [message.from, message.subject].filter(Boolean).join(' · ');

  return (
    <Pressable
      accessibilityRole={canOpen ? 'button' : undefined}
      accessibilityLabel={t('inbox.unreadable.title')}
      disabled={!canOpen}
      onPress={() => {
        if (id) onOpen?.(id);
      }}
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.text}>
        <Text style={[styles.title, { color: colors.text }]}>{t('inbox.unreadable.title')}</Text>
        {detail ? (
          <Text numberOfLines={1} style={[styles.detail, { color: colors.secondaryText }]}>
            {detail}
          </Text>
        ) : null}
      </View>
      {canOpen ? <Text style={[styles.action, { color: colors.primary }]}>{t('inbox.unreadable.open')}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  detail: {
    fontSize: 13,
    marginTop: 2,
  },
  action: {
    fontSize: 14,
    fontWeight: '600',
  },
});
