import { Button, IconButton } from '@oxy.so/bloom/button';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@oxy.so/bloom/card';
import { RiCloseLine, RiCornerUpLeftLine } from '@oxy.so/bloom/icons';
import { useState } from 'react';
import type { StaleThreadInfo } from '@/hooks/queries/useStaleThread';
import { useTranslation } from '@/lib/i18n';

interface StaleThreadBannerProps {
  staleInfo: StaleThreadInfo | null;
  onReply?: () => void;
  onDismiss?: () => void;
}

export function StaleThreadBanner({ staleInfo, onReply, onDismiss }: StaleThreadBannerProps) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);
  if (!staleInfo || dismissed) return null;
  return (
    <Card appearance="subtle" tone={staleInfo.daysSinceReceived >= 7 ? 'danger' : 'warning'}>
      <CardHeader>
        <CardTitle>
          {t(staleInfo.reason === 'unanswered_question' ? 'stale.question' : 'stale.noReply', {
            count: staleInfo.daysSinceReceived,
          })}
        </CardTitle>
        {staleInfo.reason === 'unanswered_question' && (
          <CardDescription>{t('stale.suggestion')}</CardDescription>
        )}
      </CardHeader>
      <CardFooter>
        {onReply && (
          <Button appearance="subtle" leading={<RiCornerUpLeftLine />} onPress={onReply}>
            {t('message.actions.reply')}
          </Button>
        )}
        <IconButton
          accessibilityLabel={t('stale.dismiss')}
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
