/**
 * "Some of your mail has not gone out" — in the inbox, where it is seen.
 *
 * A send is filed in Sent and delivered afterwards, so the one state a user
 * most needs to hear about — a message that did not leave — lives on a row in a
 * folder they rarely open. This reads the first page of Sent (the same cached
 * query the Sent view uses) and says so at the top of the inbox, linking there.
 *
 * Renders nothing when everything was delivered, which is the normal case, and
 * for a server that does not report delivery at all.
 */

import { useMemo } from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '@oxy.so/bloom/card';
import { useRouter } from 'expo-router';

import { SPECIAL_USE } from '@/constants/mailbox';
import { useMailboxes } from '@/hooks/queries/useMailboxes';
import { useMessages } from '@/hooks/queries/useMessages';
import { useTranslation } from '@/lib/i18n';
import { outstandingDeliveries } from '@/utils/delivery';
import { flatMessages } from '@/utils/messageCache';

export function UndeliveredBanner() {
  const router = useRouter();
  const { t } = useTranslation();
  const { data: mailboxes = [] } = useMailboxes();
  const sent = mailboxes.find((m) => m.specialUse === SPECIAL_USE.SENT);
  const { data } = useMessages({ mailboxId: sent?._id });

  const { failed, pending } = useMemo(() => outstandingDeliveries(flatMessages(data)), [data]);

  if (!sent || (failed.length === 0 && pending.length === 0)) return null;

  // Not delivered is the louder state: waiting resolves itself, failed does not.
  const isFailed = failed.length > 0;
  const count = isFailed ? failed.length : pending.length;
  const title = t(isFailed ? 'delivery.bannerFailed' : 'delivery.bannerSending', { count });
  const detail = t(isFailed ? 'delivery.bannerFailedDetail' : 'delivery.bannerSendingDetail');

  return (
    <Card
      appearance="outline"
      tone={isFailed ? 'danger' : 'neutral'}
      accessibilityLabel={`${title}. ${detail}`}
      onPress={() =>
        router.push({ pathname: '/(drawer)/(tabs)/(inbox)/[view]', params: { view: 'sent' } })
      }
    >
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{detail}</CardDescription>
      </CardHeader>
    </Card>
  );
}
