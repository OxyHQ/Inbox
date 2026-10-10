import {
  useCancelOutboundMessage,
  useRetryOutboundMessage,
} from '@/hooks/mutations/useOutboundMutations';
import { useOutboundMessages } from '@/hooks/queries/useOutboundMessages';
import type { EmailOutbox } from '@/services/emailApi';
import { Button } from '@oxy.so/bloom/button';
import { SettingsGeneralPage } from '@oxy.so/bloom/settings-modal';
import { useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation, type TranslateFn } from '@/lib/i18n';
export function statusLabel(item: EmailOutbox, t: TranslateFn): string {
  if (item.status === 'processing') return t('outbound.status.sending');
  if (item.status === 'pending') return t('outbound.status.waiting');
  if (item.status === 'failed') {
    // A spent retry budget is not "failed, will try again" — nothing will
    // happen to this message until somebody retries it by hand.
    return t(item.terminal ? 'outbound.status.notDelivered' : 'outbound.status.retrying', {
      count: item.attempts,
    });
  }
  return t('outbound.status.cancelled');
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
  const { t } = useTranslation();
  const { data: messages = [], isLoading } = useOutboundMessages();
  const retry = useRetryOutboundMessage();
  const cancel = useCancelOutboundMessage();
  const pending = useMemo(() => messages.filter((item) => item.status !== 'sent'), [messages]);

  if (isLoading || pending.length === 0) return null;

  return (
    <SettingsGeneralPage
      sections={[
        {
          key: 'queue',
          label: t('outbound.queue.title'),
          description: t('outbound.queue.description'),
          rows: pending.map((item) => ({
            key: item.id,
            label: statusLabel(item, t),
            description: [
              item.terminal
                ? t('outbound.queue.noMoreAttempts')
                : t('outbound.queue.nextAttempt', {
                    time: new Date(item.nextAttemptAt).toLocaleString(),
                  }),
              item.lastError,
            ]
              .filter(Boolean)
              .join(' '),
            control: (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {item.status === 'failed' || item.status === 'cancelled' ? (
                  <Button
                    appearance="subtle"
                    accessibilityLabel={t('outbound.queue.retryLabel')}
                    onPress={() => retry.mutate(item.id)}
                    disabled={retry.isPending}
                  >
                    {t('common.retry')}
                  </Button>
                ) : null}
                {item.status === 'pending' || item.status === 'failed' ? (
                  <Button
                    appearance="subtle"
                    accessibilityLabel={t('outbound.queue.cancelLabel')}
                    onPress={() => cancel.mutate(item.id)}
                    disabled={cancel.isPending}
                  >
                    {t('common.cancel')}
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
