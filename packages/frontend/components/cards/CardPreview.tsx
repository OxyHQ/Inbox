import { formatMoney, formatCardDate } from '@/utils/cardFormat';
/**
 * Compact single-line card preview for the inbox list.
 * Shows an icon + short summary text below the message snippet.
 */

import type { MessageCard } from '@/services/emailApi';
import { Chip } from '@oxy.so/bloom/chip';
import {
  RiSendPlaneLine,
  RiShoppingBag3Line,
  RiCalendarLine,
  RiFileList2Line,
  RiBox3Line,
  RiFileTextLine,
} from '@oxy.so/bloom/icons';
import type { BloomIconComponent } from '@oxy.so/bloom/icons';
import type { BloomTone } from '@oxy.so/bloom/appearance';

interface CardPreviewProps {
  card: MessageCard;
}

const CARD_CONFIG: Record<
  string,
  { icon: BloomIconComponent; tone: BloomTone }
> = {
  trip: { icon: RiSendPlaneLine, tone: 'info' },
  purchase: { icon: RiShoppingBag3Line, tone: 'success' },
  event: { icon: RiCalendarLine, tone: 'danger' },
  bill: { icon: RiFileList2Line, tone: 'warning' },
  package: { icon: RiBox3Line, tone: 'support' },
};

function getSummary(card: MessageCard): string {
  const d = card.data;
  // A value the extractor got wrong is left out, never shown as "Invalid Date".
  const day = (value: string | null | undefined) =>
    formatCardDate(value, { month: 'short', day: 'numeric' });
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
        'Trip details',
      );
    case 'purchase':
      return join([d.merchant, d.amount != null && formatMoney(d.amount, d.currency)], 'Purchase details');
    case 'event':
      return join([d.title, day(d.startTime)], 'Event details');
    case 'bill': {
      const due = day(d.dueDate);
      return join(
        [d.biller, d.amount != null && formatMoney(d.amount, d.currency), due && `Due ${due}`],
        'Bill details',
      );
    }
    case 'package': {
      const eta = day(d.estimatedDelivery);
      return join([d.merchant, d.status, eta && `Est. ${eta}`], 'Package details');
    }
    default:
      return '';
  }
}

export function CardPreview({ card }: CardPreviewProps) {
  const config = CARD_CONFIG[card.type] ?? {
    icon: RiFileTextLine,
    tone: 'neutral' as const,
  };
  const summary = getSummary(card);
  if (!summary) return null;
  return (
    <Chip appearance="subtle" tone={config.tone} leadingIcon={config.icon}>
      {summary}
    </Chip>
  );
}
