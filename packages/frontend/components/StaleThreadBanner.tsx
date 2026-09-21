import { Button, IconButton } from '@oxy.so/bloom/button';
import { RiCornerUpLeftLine, RiCloseLine } from '@oxy.so/bloom/icons';
import { useTheme } from '@oxy.so/bloom/theme';
/**
 * Stale Thread Banner component.
 *
 * Shows a gentle nudge when the user hasn't responded to a thread
 * that appears to need a reply.
 */

import React, { useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import { Clock01Icon } from '@hugeicons/core-free-icons';
import { Text } from '@oxy.so/bloom/typography';

import { useColors } from '@/constants/theme';
import type { StaleThreadInfo } from '@/hooks/queries/useStaleThread';

interface StaleThreadBannerProps {
  staleInfo: StaleThreadInfo | null;
  onReply?: () => void;
  onDismiss?: () => void;
}

export function StaleThreadBanner({ staleInfo, onReply, onDismiss }: StaleThreadBannerProps) {
  const colors = useColors();
  const { colors: tokens } = useTheme();
  const [dismissed, setDismissed] = useState(false);

  if (!staleInfo || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  // Different colors based on how stale
  const isVeryStale = staleInfo.daysSinceReceived >= 7;
  const bannerColor = isVeryStale ? tokens.errorSubtleForeground : tokens.warningSubtleForeground;
  const bgColor = isVeryStale ? tokens.errorSubtle : tokens.warningSubtle;
  const borderColor = 'transparent';

  return (
    <View style={[styles.container, { backgroundColor: bgColor, borderColor }]}>
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: bgColor }]}>
          {Platform.OS === 'web' ? (
            <HugeiconsIcon
              icon={Clock01Icon as unknown as IconSvgElement}
              size={16}
              color={bannerColor}
            />
          ) : (
            <MaterialCommunityIcons name="clock-alert-outline" size={16} color={bannerColor} />
          )}
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.message, { color: colors.text }]}>{staleInfo.message}</Text>
          {staleInfo.reason === 'unanswered_question' && (
            <Text style={[styles.hint, { color: colors.secondaryText }]}>
              Consider sending a quick reply
            </Text>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        {onReply && (
          <Button appearance="subtle" leading={<RiCornerUpLeftLine />} onPress={onReply}>Reply</Button>
        )}
        <IconButton accessibilityLabel="Dismiss reply reminder" icon={<RiCloseLine />} onPress={handleDismiss} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  message: {
    fontSize: 13,
    fontWeight: '500',
  },
  hint: {
    fontSize: 11,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
