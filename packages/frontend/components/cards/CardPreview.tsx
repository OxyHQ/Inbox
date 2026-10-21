import { formatMoney, formatCardDate } from '@/utils/cardFormat';
/**
 * Compact rich preview for the inbox attachment rail.
 * Shows the extracted details without inventing unavailable artwork.
 */

import type { MessageCard } from '@/services/emailApi';
import { Card } from '@oxy.so/bloom/card';
import { Text } from '@oxy.so/bloom/typography';
import { useTheme } from '@oxy.so/bloom/theme';
import { View } from 'react-native';
import { RiSendPlaneLine } from '@oxy.so/bloom/icons/RiSendPlaneLine';
import { RiShoppingBag3Line } from '@oxy.so/bloom/icons/RiShoppingBag3Line';
import { RiCalendarLine } from '@oxy.so/bloom/icons/RiCalendarLine';
import { RiFileList2Line } from '@oxy.so/bloom/icons/RiFileList2Line';
import { RiBox3Line } from '@oxy.so/bloom/icons/RiBox3Line';
import { RiFileTextLine } from '@oxy.so/bloom/icons/RiFileTextLine';
import type { BloomIconComponent } from '@oxy.so/bloom/icons';
import type { BloomTone } from '@oxy.so/bloom/appearance';
import { useTranslation, type TranslateFn } from '@/lib/i18n';

interface CardPreviewProps {
  card: MessageCard;
}

const CARD_CONFIG: Record<string, { icon: BloomIconComponent; tone: BloomTone }> = {
  trip: { icon: RiSendPlaneLine, tone: 'info' },
  purchase: { icon: RiShoppingBag3Line, tone: 'success' },
  event: { icon: RiCalendarLine, tone: 'danger' },
  bill: { icon: RiFileList2Line, tone: 'warning' },
  package: { icon: RiBox3Line, tone: 'support' },
};

function getSummary(card: MessageCard, t: TranslateFn, locale: string): string {
  const d = card.data;
  // A value the extractor got wrong is left out, never shown as "Invalid Date".
  const day = (value: string | null | undefined) =>
    formatCardDate(locale, value, { month: 'short', day: 'numeric' });
  const join = (parts: (string | null | undefined | false)[], fallback: string) =>
    parts.filter(Boolean).join(' · ') || fallback;
  switch (card.type) {
    case 'trip':
      return join(
        [
          d.airline,
          d.departure && d.arrival && `${d.departure} → ${d.arrival}`,
          day(d.departureTime),
        ],
        t('cards.trip.summary'),
      );
    case 'purchase':
      return join(
        [d.merchant, d.amount != null && formatMoney(locale, d.amount, d.currency)],
        t('cards.purchase.summary'),
      );
    case 'event':
      return join([d.title, day(d.startTime)], t('cards.event.summary'));
    case 'bill': {
      const due = day(d.dueDate);
      return join(
        [
          d.biller,
          d.amount != null && formatMoney(locale, d.amount, d.currency),
          due && t('cards.bill.due', { date: due }),
        ],
        t('cards.bill.summary'),
      );
    }
    case 'package': {
      const eta = day(d.estimatedDelivery);
      return join(
        [d.merchant, d.status, eta && t('cards.package.estimated', { date: eta })],
        t('cards.package.summary'),
      );
    }
    default:
      return '';
  }
}

export function CardPreview({ card }: CardPreviewProps) {
  const { t, locale } = useTranslation();
  const { colors } = useTheme();
  const config = CARD_CONFIG[card.type] ?? {
    icon: RiFileTextLine,
    tone: 'neutral' as const,
  };
  const summary = getSummary(card, t, locale);
  if (!summary) return null;
  const Icon = config.icon;
  return (
    <Card
      appearance="subtle"
      tone={config.tone}
      radius="radius-8"
      border="hairline"
      elevation="none"
      clipContent
      style={{ width: 256, height: 88, flexShrink: 0 }}
      contentStyle={{ flexDirection: 'row', alignItems: 'center' }}
    >
      <View style={{ width: 64, alignItems: 'center', justifyContent: 'center' }}>
        <Icon width={32} height={32} fill={colors.textSecondary} />
      </View>
      <Text variant="body-2-regular" numberOfLines={3} style={{ flex: 1, padding: 12 }}>
        {summary}
      </Text>
    </Card>
  );
}
