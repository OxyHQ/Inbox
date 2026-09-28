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
  switch (card.type) {
    case 'trip': {
      const parts: string[] = [];
      if (d.airline) parts.push(d.airline);
      if (d.departure && d.arrival) parts.push(`${d.departure} → ${d.arrival}`);
      if (d.departureTime) {
        parts.push(
          new Date(d.departureTime).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          }),
        );
      }
      return parts.join(' · ') || 'Trip details';
    }
    case 'purchase': {
      const parts: string[] = [];
      if (d.merchant) parts.push(d.merchant);
      if (d.amount != null) {
        parts.push(
          new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: d.currency || 'USD',
          }).format(d.amount),
        );
      }
      return parts.join(' · ') || 'Purchase details';
    }
    case 'event': {
      const parts: string[] = [];
      if (d.title) parts.push(d.title);
      if (d.startTime) {
        parts.push(
          new Date(d.startTime).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          }),
        );
      }
      return parts.join(' · ') || 'Event details';
    }
    case 'bill': {
      const parts: string[] = [];
      if (d.biller) parts.push(d.biller);
      if (d.amount != null) {
        parts.push(
          new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: d.currency || 'USD',
          }).format(d.amount),
        );
      }
      if (d.dueDate) {
        parts.push(
          `Due ${new Date(d.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
        );
      }
      return parts.join(' · ') || 'Bill details';
    }
    case 'package': {
      const parts: string[] = [];
      if (d.merchant) parts.push(d.merchant);
      if (d.status) parts.push(d.status);
      if (d.estimatedDelivery) {
        parts.push(
          `Est. ${new Date(d.estimatedDelivery).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
        );
      }
      return parts.join(' · ') || 'Package details';
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
