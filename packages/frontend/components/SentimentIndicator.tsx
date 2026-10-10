import { Badge } from '@oxy.so/bloom/badge';
import { RiAlertLine, RiThumbUpLine, RiSendPlaneLine, RiEmotionLine } from '@oxy.so/bloom/icons';
import type { BloomTone } from '@oxy.so/bloom/appearance';
import type { SentimentResult } from '@/hooks/queries/useSentimentAnalysis';
import { useTranslation } from '@/lib/i18n';
interface SentimentIndicatorProps {
  sentiment: SentimentResult | null;
  size?: 'small' | 'medium';
  showLabel?: boolean;
}
const TONES: Record<SentimentResult['type'], BloomTone> = {
  urgent: 'danger',
  frustrated: 'warning',
  positive: 'success',
  formal: 'neutral',
  neutral: 'neutral',
  request: 'info',
};
export function SentimentIndicator({
  sentiment,
  size = 'small',
  showLabel = false,
}: SentimentIndicatorProps) {
  const { t } = useTranslation();
  if (!sentiment) return null;
  const Icon =
    sentiment.type === 'positive'
      ? RiThumbUpLine
      : sentiment.type === 'request'
        ? RiSendPlaneLine
        : ['urgent', 'frustrated'].includes(sentiment.type)
          ? RiAlertLine
          : RiEmotionLine;
  // Keep the textual meaning available even in compact message rows.
  return (
    <Badge
      tone={TONES[sentiment.type]}
      appearance="subtle"
      icon={Icon}
      content={t(`sentiment.${sentiment.type}`)}
      size={showLabel && size === 'medium' ? 'label-medium' : 'label-small'}
    />
  );
}
