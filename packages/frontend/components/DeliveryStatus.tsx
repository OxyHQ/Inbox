/**
 * Where a message the user sent stands, wherever that message is shown.
 *
 * `DeliveryBadge` is the one-line form for a list row; `DeliveryNotice` is the
 * full form for the message itself, with the reason and what the user can do
 * about it. Both render nothing for received mail and for delivered mail —
 * delivered is the normal case and needs no decoration.
 */

import { StyleSheet, View } from 'react-native';
import { Text } from '@oxy.so/bloom/typography';
import {
  AdmonitionButton,
  AdmonitionContent,
  AdmonitionIcon,
  AdmonitionRoot,
  AdmonitionRow,
  AdmonitionText,
} from '@oxy.so/bloom/admonition';

import { useColors } from '@/constants/theme';
import { useEditAsNew } from '@/hooks/mutations/useEditAsNew';
import { useRetryDelivery } from '@/hooks/mutations/useRetryDelivery';
import { useTranslation } from '@/lib/i18n';
import type { Message, MessageDelivery } from '@/schemas/emailSchemas';
import { dateFormatter } from '@/utils/dateFormat';
import { canRetry, deliveryReasonKey, isOutstanding } from '@/utils/delivery';

const NEXT_ATTEMPT_TIME: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };

/** The one-line label for a delivery: "Sending…", "Retrying (2)", "Not delivered". */
export function useDeliveryLabel() {
  const { t } = useTranslation();
  return (delivery: MessageDelivery): string => {
    switch (delivery.state) {
      case 'sending':
        return t('delivery.sending');
      case 'retrying':
        return t('delivery.retrying', { count: delivery.attempts });
      case 'failed':
        return t('delivery.failed');
      case 'sent':
        return '';
    }
  };
}

/** Compact status for a message list row. */
export function DeliveryBadge({ delivery }: { delivery: MessageDelivery | undefined }) {
  const colors = useColors();
  const label = useDeliveryLabel();
  if (!isOutstanding(delivery)) return null;

  const color =
    delivery.state === 'failed'
      ? colors.error
      : delivery.state === 'retrying'
        ? colors.warning
        : colors.secondaryText;
  return (
    <Text accessibilityRole="text" style={[styles.badge, { color }]} numberOfLines={1}>
      {label(delivery)}
    </Text>
  );
}

/** Full status for an open message: why, when it retries, and what to do. */
export function DeliveryNotice({ message }: { message: Message }) {
  const { t, locale } = useTranslation();
  const editAsNew = useEditAsNew();
  const label = useDeliveryLabel();
  const retry = useRetryDelivery();
  const { delivery } = message;
  if (!isOutstanding(delivery)) return null;

  const type =
    delivery.state === 'failed' ? 'error' : delivery.state === 'retrying' ? 'warning' : 'info';
  const reasonKey = delivery.state === 'sending' ? null : deliveryReasonKey(delivery);
  const reason = reasonKey ? t(reasonKey) : null;
  const nextAttempt =
    delivery.state === 'retrying' && delivery.nextAttemptAt
      ? t('delivery.nextAttempt', {
          time: dateFormatter(locale, NEXT_ATTEMPT_TIME).format(new Date(delivery.nextAttemptAt)),
        })
      : null;

  return (
    <View style={styles.notice}>
      <AdmonitionRoot type={type}>
        <AdmonitionRow>
          <AdmonitionIcon />
          <AdmonitionContent>
            <AdmonitionText>
              {[label(delivery), reason, nextAttempt].filter(Boolean).join(' · ')}
            </AdmonitionText>
            {delivery.error ? <AdmonitionText>{delivery.error}</AdmonitionText> : null}
          </AdmonitionContent>
          {delivery.state === 'failed' ? (
            <>
              {canRetry(delivery) ? (
                <AdmonitionButton
                  onPress={() => retry.mutate(message._id)}
                  disabled={retry.isPending}
                >
                  {t('delivery.retry')}
                </AdmonitionButton>
              ) : null}
              <AdmonitionButton
                onPress={() => editAsNew.editAsNew(message)}
                disabled={editAsNew.isPending}
              >
                {t('delivery.editAsNew')}
              </AdmonitionButton>
            </>
          ) : null}
        </AdmonitionRow>
      </AdmonitionRoot>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { fontSize: 12, fontWeight: '600' },
  notice: { marginBottom: 12 },
});
