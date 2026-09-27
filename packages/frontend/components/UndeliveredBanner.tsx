/**
 * "Some of your mail has not gone out" — in the inbox, where it is seen.
 *
 * A send is filed in Sent and delivered afterwards, so the one state a user
 * most needs to hear about — a message that did not leave — lives on a row in a
 * folder they rarely open. This reads the first page of Sent (the same cached
 * query the Sent view uses) and says so at the top of the inbox, linking there.
 *
 * Renders nothing when everything was delivered, which is the normal case.
 */

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { RiErrorWarningFill, RiTimeLine } from '@oxy.so/bloom/icons';

import { SPACING } from '@/constants/layout';
import { SPECIAL_USE } from '@/constants/mailbox';
import { useColors } from '@/constants/theme';
import { useMailboxes } from '@/hooks/queries/useMailboxes';
import { useMessages } from '@/hooks/queries/useMessages';
import { useTranslation } from '@/lib/i18n';
import { outstandingDeliveries } from '@/utils/delivery';
import { flatMessages } from '@/utils/messageCache';

export function UndeliveredBanner() {
  const colors = useColors();
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
  const Icon = isFailed ? RiErrorWarningFill : RiTimeLine;
  const accent = isFailed ? colors.error : colors.secondaryText;
  const title = t(isFailed ? 'delivery.bannerFailed' : 'delivery.bannerSending', { count });
  const detail = t(isFailed ? 'delivery.bannerFailedDetail' : 'delivery.bannerSendingDetail');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      onPress={() => router.push({ pathname: '/(drawer)/(tabs)/(inbox)/[view]', params: { view: sent._id } })}
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
