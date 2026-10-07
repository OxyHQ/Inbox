/**
 * The stacked-envelope header of the Subscriptions screen.
 *
 * One column per sender, ordered by volume: the sender's avatar and message
 * count on top, and beneath it a literal pile of envelopes — one per message.
 * The pile is the point: a sender you get 18 emails from towers over one you
 * get 2 from, which a number alone never conveys.
 *
 * The pile is a fixed-height box with each envelope absolutely placed one step
 * above the last, so the box measures exactly the paper it holds. Letting the
 * envelopes overflow a too-short container instead would leave the bottom one
 * clipped by the scroll view. Columns are bottom-aligned so the piles grow
 * upward from a shared baseline.
 */

import React, { useCallback, useMemo } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Card, CardHeader } from '@oxy.so/bloom/card';
import { Carousel, CarouselItem } from '@oxy.so/bloom/carousel';
import { useTranslation } from '@/lib/i18n';
import { Text } from '@oxy.so/bloom/typography';
import { SPACING as BLOOM_SPACING } from '@oxy.so/bloom/design-tokens';

import { Avatar } from './Avatar';
import type { Subscription } from '@/services/emailApi';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.oxy.so';

/**
 * Ceiling on how tall a pile can get. High enough that a heavy sender really
 * towers (at `ENVELOPE_STEP` per envelope, 60 is ~360dp of paper), low enough
 * that one outlier does not push the header off the screen.
 */
const MAX_ENVELOPES = 60;
/** Rendered envelope size. */
const ENVELOPE_WIDTH = 60;
const ENVELOPE_HEIGHT = 40;
/** Vertical step between envelopes. Smaller than the image, hence the overlap. */
const ENVELOPE_STEP = 6;
/** Resolved once: a pile can hold 60 of these, and every column draws a pile. */
const ENVELOPE_SOURCE = require('@/assets/images/envelope.png');

function EnvelopePile({ count }: { count: number }) {
  const envelopes = useMemo(
    () => Array.from({ length: Math.min(count, MAX_ENVELOPES) }, (_, i) => i),
    [count],
  );

  // The bottom envelope sits at 0 and the top one at (n-1) steps, so the box
  // has to be that tall plus one whole envelope.
  const height = (envelopes.length - 1) * ENVELOPE_STEP + ENVELOPE_HEIGHT;

  return (
    <View style={[styles.pile, { height }]}>
      {envelopes.map((i) => (
        <Image
          key={i}
          source={ENVELOPE_SOURCE}
          style={[styles.envelope, { bottom: i * ENVELOPE_STEP }]}
          resizeMode="contain"
        />
      ))}
    </View>
  );
}

interface SubscriptionStacksProps {
  subscriptions: Subscription[];
  onSelect?: (subscriptionId: string) => void;
}

export function SubscriptionStacks({
  subscriptions,
  onSelect,
}: SubscriptionStacksProps) {
  const { t } = useTranslation();
  const ordered = useMemo(
    () => [...subscriptions].sort((a, b) => b.messageCount - a.messageCount),
    [subscriptions],
  );

  if (ordered.length === 0) return null;

  return (
    <Carousel
      accessibilityLabel={t('drawer.subscriptions')}
      testID="subscriptions-carousel"
      inset={BLOOM_SPACING['space-16']}
      gap={BLOOM_SPACING['space-12']}
      showDots={false}
      style={styles.carousel}
    >
      {ordered.map((sub) => (
        <CarouselItem
          key={sub._id}
          width={ENVELOPE_WIDTH + BLOOM_SPACING['space-12']}
          style={styles.slide}
          accessibilityLabel={`${sub.name}, ${sub.messageCount}`}
        >
          <SubscriptionColumn subscription={sub} onSelect={onSelect} />
        </CarouselItem>
      ))}
    </Carousel>
  );
}

function SubscriptionColumn({
  subscription,
  onSelect,
}: {
  subscription: Subscription;
  onSelect?: (subscriptionId: string) => void;
}) {
  const handlePress = useCallback(
    () => onSelect?.(subscription._id),
    [onSelect, subscription._id],
  );

  return (
    <View style={styles.column}>
      <Card
        appearance="plain"
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`${subscription.name}, ${subscription.messageCount} messages`}
      >
        <CardHeader>
          <View className="items-center gap-1">
            <Avatar
              name={subscription.name}
              size={40}
              avatarUrl={
                subscription.senderAvatarPath
                  ? `${API_URL}${subscription.senderAvatarPath}`
                  : null
              }
            />
            <Text variant="body-2-medium">{subscription.messageCount}</Text>
          </View>
        </CardHeader>
      </Card>

      <EnvelopePile count={subscription.messageCount} />
    </View>
  );
}

const styles = StyleSheet.create({
  carousel: {
    // The viewport fills the panel; Bloom keeps first/last spacing inside it.
    paddingTop: BLOOM_SPACING['space-32'],
  },
  slide: {
    // Stretch the slide, then align its pile to the shared baseline.
    justifyContent: 'flex-end',
  },
  column: {
    flexShrink: 0,
    alignItems: 'center',
  },
  pile: {
    width: ENVELOPE_WIDTH,
    pointerEvents: 'none',
  },
  envelope: {
    position: 'absolute',
    left: 0,
    width: ENVELOPE_WIDTH,
    height: ENVELOPE_HEIGHT,
  },
});
