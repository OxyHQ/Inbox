import { useMemo } from 'react';
import { View } from 'react-native';
import { SettingsGeneralPage } from '@oxy.so/bloom/settings-modal';
import { Button } from '@oxy.so/bloom/button';
import { useOutboundMessages } from '@/hooks/queries/useOutboundMessages';
import {
  useCancelOutboundMessage,
  useRetryOutboundMessage,
} from '@/hooks/mutations/useOutboundMutations';
import type { EmailOutbox } from '@/services/emailApi';
export function statusLabel(item: EmailOutbox): string {
  if (item.status === 'processing') return 'Sending…';
  if (item.status === 'pending') return 'Waiting to send';
  if (item.status === 'failed') {
    const attempts = `${item.attempts} attempt${item.attempts === 1 ? '' : 's'}`;
    // A spent retry budget is not "failed, will try again" — nothing will
    // happen to this message until somebody retries it by hand.
    return item.terminal
      ? `Not delivered after ${attempts}`
      : `Retrying after ${attempts}`;
  }
  return 'Cancelled';
}

/** Messages that still owe the user a delivery, by the queue's own reckoning. */
export function outstandingOutbound(messages: EmailOutbox[]): EmailOutbox[] {
  return messages.filter(
    (item) => item.status !== 'sent' && item.status !== 'cancelled',
  );
}

/** Of those, the ones that will not move again on their own. */
export function stuckOutbound(messages: EmailOutbox[]): EmailOutbox[] {
  return outstandingOutbound(messages).filter((item) => item.terminal === true);
}

export function OutboundQueueSection() {
  const { data: messages = [], isLoading } = useOutboundMessages();
  const retry = useRetryOutboundMessage();
  const cancel = useCancelOutboundMessage();
  const pending = useMemo(
    () => messages.filter((item) => item.status !== 'sent'),
    [messages],
  );

  if (isLoading || pending.length === 0) return null;

  return (
    <SettingsGeneralPage
      sections={[
        {
          key: 'queue',
          label: 'Delivery queue',
          description:
            'Messages are retried safely in the background. You can inspect a failure or stop a queued delivery.',
          rows: pending.map((item) => ({
            key: item.id,
            label: statusLabel(item),
            description: [
              item.terminal
                ? 'No further attempts will be made automatically.'
                : `Next attempt: ${new Date(item.nextAttemptAt).toLocaleString()}`,
              item.lastError,
            ]
              .filter(Boolean)
              .join(' '),
            control: (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {item.status === 'failed' || item.status === 'cancelled' ? (
                  <Button
                    size="sm"
                    appearance="subtle"
                    accessibilityLabel="Retry queued message"
                    onPress={() => retry.mutate(item.id)}
                    disabled={retry.isPending}
                  >
                    Retry
                  </Button>
                ) : null}
                {item.status === 'pending' || item.status === 'failed' ? (
                  <Button
                    size="sm"
                    appearance="subtle"
                    accessibilityLabel="Cancel queued message"
                    onPress={() => cancel.mutate(item.id)}
                    disabled={cancel.isPending}
                  >
                    Cancel
                  </Button>
                ) : null}
              </View>
            ),
          })),
        },
      ]}
    />
  );
}
