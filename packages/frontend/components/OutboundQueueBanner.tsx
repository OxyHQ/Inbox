/**
 * "Some of your mail has not gone out" — in the inbox, where it is seen.
 *
 * The delivery queue already existed, but only as a section of Settings →
 * Advanced that hides itself when empty. So the one state the user most needs
 * to know about was the one nowhere in the app mentioned: a total outbound
 * outage looked exactly like a working inbox, because the composer closed, the
 * toast said "queued", and the queue was three taps away behind a heading
 * nobody opens.
 *
 * Renders nothing when there is nothing outstanding, which is the normal case.
 */

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { RiErrorWarningFill, RiTimeLine } from '@oxy.so/bloom/icons';

import { useColors } from '@/constants/theme';
import { SPACING } from '@/constants/layout';
import { useOutboundMessages } from '@/hooks/queries/useOutboundMessages';
import { outstandingOutbound, stuckOutbound } from '@/components/settings/OutboundQueueSection';

export function OutboundQueueBanner() {
  const colors = useColors();
  const router = useRouter();
  const { data: messages = [] } = useOutboundMessages();

  const { outstanding, stuck } = useMemo(
    () => ({ outstanding: outstandingOutbound(messages), stuck: stuckOutbound(messages) }),
    [messages],
  );

  if (outstanding.length === 0) return null;

  // Stuck is the louder state: waiting is normal and self-resolving, not
  // delivered is not.
  const isStuck = stuck.length > 0;
  const count = isStuck ? stuck.length : outstanding.length;
  const Icon = isStuck ? RiErrorWarningFill : RiTimeLine;
  const accent = isStuck ? colors.error : colors.secondaryText;

  const title = isStuck
    ? `${count} message${count === 1 ? '' : 's'} could not be sent`
    : `${count} message${count === 1 ? '' : 's'} waiting to send`;
  const detail = isStuck
    ? 'They are still saved. Open the delivery queue to see why and retry.'
    : 'They will go out on their own; open the delivery queue to follow along.';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      onPress={() => router.push('/settings/advanced')}
      style={[styles.container, { borderColor: accent, backgroundColor: colors.surface }]}
    >
      <Icon size="sm" color={accent} />
      <View style={styles.text}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.detail, { color: colors.secondaryText }]}>{detail}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
  },
  text: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600' },
  detail: { fontSize: 12, marginTop: 2 },
});
