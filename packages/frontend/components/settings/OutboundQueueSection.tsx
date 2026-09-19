import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RiUpload2Line } from '@oxy.so/bloom/icons';
import { useColors } from '@/constants/theme';
import { useOutboundMessages } from '@/hooks/queries/useOutboundMessages';
import { useCancelOutboundMessage, useRetryOutboundMessage } from '@/hooks/mutations/useOutboundMutations';
import { SectionHeader } from '@/components/settings/SectionHeader';
import type { EmailOutbox } from '@/services/emailApi';

export function statusLabel(item: EmailOutbox): string {
  if (item.status === 'processing') return 'Sending…';
  if (item.status === 'pending') return 'Waiting to send';
  if (item.status === 'failed') {
    const attempts = `${item.attempts} attempt${item.attempts === 1 ? '' : 's'}`;
    // A spent retry budget is not "failed, will try again" — nothing will
    // happen to this message until somebody retries it by hand.
    return item.terminal ? `Not delivered after ${attempts}` : `Retrying after ${attempts}`;
  }
  return 'Cancelled';
}

/** Messages that still owe the user a delivery, by the queue's own reckoning. */
export function outstandingOutbound(messages: EmailOutbox[]): EmailOutbox[] {
  return messages.filter((item) => item.status !== 'sent' && item.status !== 'cancelled');
}

/** Of those, the ones that will not move again on their own. */
export function stuckOutbound(messages: EmailOutbox[]): EmailOutbox[] {
  return outstandingOutbound(messages).filter((item) => item.terminal === true);
}

export function OutboundQueueSection() {
  const colors = useColors();
  const { data: messages = [], isLoading } = useOutboundMessages();
  const retry = useRetryOutboundMessage();
  const cancel = useCancelOutboundMessage();
  const pending = useMemo(() => messages.filter((item) => item.status !== 'sent'), [messages]);

  if (isLoading || pending.length === 0) return null;

  return (
    <View style={styles.subsection}>
      <SectionHeader icon={RiUpload2Line} title="Delivery queue" />
      <Text style={[styles.description, { color: colors.secondaryText }]}>
        Messages are retried safely in the background. You can inspect a failure or stop a queued delivery.
      </Text>
      <View style={[styles.list, { borderColor: colors.border }]}>
        {pending.map((item, index) => (
          <View key={item.id} style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
            <View style={styles.main}>
              <Text style={[styles.status, { color: item.terminal ? colors.error : colors.text }]}>
                {statusLabel(item)}
              </Text>
              <Text style={[styles.detail, { color: colors.secondaryText }]} numberOfLines={1}>
                {item.terminal
                  ? 'No further attempts will be made automatically.'
                  : `Next attempt: ${new Date(item.nextAttemptAt).toLocaleString()}`}
              </Text>
              {item.lastError ? (
                <Text style={[styles.error, { color: colors.error }]} numberOfLines={2}>{item.lastError}</Text>
              ) : null}
            </View>
            {item.status === 'failed' || item.status === 'cancelled' ? (
              <Pressable
                onPress={() => retry.mutate(item.id)}
                disabled={retry.isPending}
                accessibilityRole="button"
                accessibilityLabel="Retry queued message"
                style={styles.action}
              >
                <Text style={[styles.actionText, { color: colors.primary }]}>Retry</Text>
              </Pressable>
            ) : null}
            {item.status === 'pending' || item.status === 'failed' ? (
              <Pressable
                onPress={() => cancel.mutate(item.id)}
                disabled={cancel.isPending}
                accessibilityRole="button"
                accessibilityLabel="Cancel queued message"
                style={styles.action}
              >
                <Text style={[styles.actionText, { color: colors.secondaryText }]}>Cancel</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  subsection: { gap: 10 },
  description: { fontSize: 14, lineHeight: 20 },
  list: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  main: { flex: 1, gap: 3 },
  status: { fontSize: 14, fontWeight: '600' },
  detail: { fontSize: 12 },
  error: { fontSize: 12 },
  action: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 6 },
  actionText: { fontSize: 13, fontWeight: '600' },
});
