import { useTheme, resolveAccentColors } from '@oxy.so/bloom/theme';
/**
 * Sentiment Indicator component.
 *
 * Shows visual indicator for email sentiment/tone:
 * - Urgent (red alert)
 * - Frustrated/needs attention (orange warning)
 * - Positive (green)
 * - Formal (gray)
 * - Action requested (blue)
 */

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import { Alert01Icon, ThumbsUpIcon, SentIcon } from '@hugeicons/core-free-icons';
import { Text } from '@oxy.so/bloom/typography';

import type { SentimentResult } from '@/hooks/queries/useSentimentAnalysis';

interface SentimentIndicatorProps {
  sentiment: SentimentResult | null;
  size?: 'small' | 'medium';
  showLabel?: boolean;
}

export function SentimentIndicator({
  sentiment,
  size = 'small',
  showLabel = false,
}: SentimentIndicatorProps) {
  const { colors } = useTheme();
  if (!sentiment) return null;
  const palette = resolveAccentColors(colors, { urgent: 'error', frustrated: 'warning', positive: 'success', formal: 'default', neutral: 'default', request: 'info' }[sentiment.type] as 'error' | 'warning' | 'success' | 'default' | 'info', 'subtle');

  const iconSize = size === 'small' ? 12 : 16;
  const fontSize = size === 'small' ? 10 : 12;

  // Use web-specific icons when available
  const renderIcon = () => {
    if (Platform.OS === 'web') {
      switch (sentiment.type) {
        case 'urgent':
        case 'frustrated':
          return (
            <HugeiconsIcon
              icon={Alert01Icon as unknown as IconSvgElement}
              size={iconSize}
              color={palette.foreground}
            />
          );
        case 'positive':
          return (
            <HugeiconsIcon
              icon={ThumbsUpIcon as unknown as IconSvgElement}
              size={iconSize}
              color={palette.foreground}
            />
          );
        case 'request':
          return (
            <HugeiconsIcon
              icon={SentIcon as unknown as IconSvgElement}
              size={iconSize}
              color={palette.foreground}
            />
          );
        default:
          return (
            <MaterialCommunityIcons
              name={sentiment.icon}
              size={iconSize}
              color={palette.foreground}
            />
          );
      }
    }

    return (
      <MaterialCommunityIcons
        name={sentiment.icon}
        size={iconSize}
        color={palette.foreground}
      />
    );
  };

  if (!showLabel) {
    // Just the icon for compact display
    return (
      <View accessibilityRole="image" accessibilityLabel={sentiment.label} style={[styles.iconOnly, { backgroundColor: palette.background }]}>
        {renderIcon()}
      </View>
    );
  }

  // Full badge with label
  return (
    <View
      style={[
        styles.badge,
        size === 'medium' && styles.badgeMedium,
        { backgroundColor: palette.background },
      ]}
    >
      {renderIcon()}
      <Text style={[styles.label, { color: palette.foreground, fontSize }]}>
        {sentiment.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  iconOnly: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeMedium: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  label: {
    fontWeight: '600',
  },
});
