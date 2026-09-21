/**
 * Compact single-line card preview for the inbox list.
 * Shows an icon + short summary text below the message snippet.
 */

import React, { type ComponentProps } from 'react';
import { View, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@oxy.so/bloom/typography';
import { useTheme, resolveAccentColors, type AccentTone } from '@oxy.so/bloom/theme';
import type { MessageCard } from '@/services/emailApi';

type MaterialCommunityIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

interface CardPreviewProps {
  card: MessageCard;
}

const CARD_CONFIG: Record<string, { icon: MaterialCommunityIconName; tone: AccentTone }> = {
  trip: { icon: 'airplane', tone: 'info' },
  purchase: { icon: 'shopping-outline', tone: 'success' },
  event: { icon: 'calendar', tone: 'error' },
  bill: { icon: 'receipt', tone: 'warning' },
  package: { icon: 'package-variant', tone: 'tertiary' },
};

function getSummary(card: MessageCard): string {
  const d = card.data;
  switch (card.type) {
    case 'trip': {
      const parts: string[] = [];
      if (d.airline) parts.push(d.airline);
      if (d.departure && d.arrival) parts.push(`${d.departure} → ${d.arrival}`);
      if (d.departureTime) {
        parts.push(new Date(d.departureTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
      }
      return parts.join(' · ') || 'Trip details';
    }
    case 'purchase': {
      const parts: string[] = [];
      if (d.merchant) parts.push(d.merchant);
      if (d.amount != null) {
        parts.push(new Intl.NumberFormat(undefined, { style: 'currency', currency: d.currency || 'USD' }).format(d.amount));
      }
      return parts.join(' · ') || 'Purchase details';
    }
    case 'event': {
      const parts: string[] = [];
      if (d.title) parts.push(d.title);
      if (d.startTime) {
        parts.push(new Date(d.startTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
      }
      return parts.join(' · ') || 'Event details';
    }
    case 'bill': {
      const parts: string[] = [];
      if (d.biller) parts.push(d.biller);
      if (d.amount != null) {
        parts.push(new Intl.NumberFormat(undefined, { style: 'currency', currency: d.currency || 'USD' }).format(d.amount));
      }
      if (d.dueDate) {
        parts.push(`Due ${new Date(d.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`);
      }
      return parts.join(' · ') || 'Bill details';
    }
    case 'package': {
      const parts: string[] = [];
      if (d.merchant) parts.push(d.merchant);
      if (d.status) parts.push(d.status);
      if (d.estimatedDelivery) {
        parts.push(`Est. ${new Date(d.estimatedDelivery).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`);
      }
      return parts.join(' · ') || 'Package details';
    }
    default:
      return '';
  }
}

export function CardPreview({ card }: CardPreviewProps) {
  const { colors } = useTheme();
  const config = CARD_CONFIG[card.type] || { icon: 'card-outline', tone: 'default' as const };
  const palette = resolveAccentColors(colors, config.tone, 'subtle');
  const summary = getSummary(card);

  if (!summary) return null;

  return (
    <View style={[styles.container, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <MaterialCommunityIcons name={config.icon} size={14} color={palette.foreground} />
      <Text style={[styles.text, { color: palette.foreground }]} numberOfLines={1}>
        {summary}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 1,
  },
});
