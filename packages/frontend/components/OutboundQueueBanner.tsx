/**
 * "Some of your mail has not gone out" — in the inbox, where it is seen.
 *
 * The delivery queue already existed, but only as a section of Settings →
 * Advanced that hides itself when empty. So the one state the user most needs
 * to know about was the one nowhere in the app mentioned: a total outbound
 * outage looked exactly like a working inbox, because the composer closed, the
 * toast said "queued", and the queue was three taps away behind a heading
 * nobody opens.
 *
 * Renders nothing when there is nothing outstanding, which is the normal case.
 */

import React, { useMemo } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@oxy.so/bloom/card';
import { useRouter } from 'expo-router';

import { useOutboundMessages } from '@/hooks/queries/useOutboundMessages';
import {
  outstandingOutbound,
  stuckOutbound,
} from '@/components/settings/OutboundQueueSection';

export function OutboundQueueBanner() {
  const router = useRouter();
  const { data: messages = [] } = useOutboundMessages();

  const { outstanding, stuck } = useMemo(
    () => ({
      outstanding: outstandingOutbound(messages),
      stuck: stuckOutbound(messages),
    }),
    [messages],
  );

  if (outstanding.length === 0) return null;

  // Stuck is the louder state: waiting is normal and self-resolving, not
  // delivered is not.
  const isStuck = stuck.length > 0;
  const count = isStuck ? stuck.length : outstanding.length;

  const title = isStuck
    ? `${count} message${count === 1 ? '' : 's'} could not be sent`
    : `${count} message${count === 1 ? '' : 's'} waiting to send`;
  const detail = isStuck
    ? 'They are still saved. Open the delivery queue to see why and retry.'
    : 'They will go out on their own; open the delivery queue to follow along.';

  return (
    <Card
      appearance="outline"
      tone={isStuck ? 'danger' : 'neutral'}
      accessibilityLabel={`${title}. ${detail}`}
      onPress={() => router.push('/settings/advanced')}
    >
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{detail}</CardDescription>
      </CardHeader>
    </Card>
  );
}
