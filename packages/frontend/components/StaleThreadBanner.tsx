import { Button, IconButton } from '@oxy.so/bloom/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@oxy.so/bloom/card';
import { RiCloseLine, RiCornerUpLeftLine } from '@oxy.so/bloom/icons';
import { useState } from 'react';
import type { StaleThreadInfo } from '@/hooks/queries/useStaleThread';

interface StaleThreadBannerProps {
  staleInfo: StaleThreadInfo | null;
  onReply?: () => void;
  onDismiss?: () => void;
}

export function StaleThreadBanner({
  staleInfo,
  onReply,
  onDismiss,
}: StaleThreadBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (!staleInfo || dismissed) return null;
  return (
    <Card
      appearance="subtle"
      tone={staleInfo.daysSinceReceived >= 7 ? 'danger' : 'warning'}
    >
      <CardHeader>
        <CardTitle>{staleInfo.message}</CardTitle>
        {staleInfo.reason === 'unanswered_question' && (
          <CardDescription>Consider sending a quick reply</CardDescription>
        )}
      </CardHeader>
      <CardFooter>
        {onReply && (
          <Button
            appearance="subtle"
            leading={<RiCornerUpLeftLine />}
            onPress={onReply}
          >
            Reply
          </Button>
        )}
        <IconButton
          accessibilityLabel="Dismiss reply reminder"
          icon={<RiCloseLine />}
          onPress={() => {
            setDismissed(true);
            onDismiss?.();
          }}
        />
      </CardFooter>
    </Card>
  );
}
