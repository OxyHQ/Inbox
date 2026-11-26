import { Chip } from '@oxy.so/bloom/chip';
import { Text } from '@oxy.so/bloom/typography';
import { SentimentIndicator } from '@/components/SentimentIndicator';
import { ThreadSummary } from '@/components/ThreadSummary';
import type { SentimentResult } from '@/hooks/queries/useSentimentAnalysis';
import { useTranslation } from '@/lib/i18n';
import type { Message } from '@/services/emailApi';
import {
  Chip as LChip,
  Embed,
  HStack,
  Text as LText,
  VStack,
  toElement,
} from '@oxy.so/bloom-language';

interface ThreadOverviewProps {
  messageId: string;
  subject: string;
  messages: Message[];
  count: number;
  labels: { _id: string; name: string }[];
  sentiment: SentimentResult | null;
  onRemoveLabel: (name: string) => void;
}

/** Inbox metadata and inference, composed from Bloom's typography and controls. */
export function ThreadOverview({
  messageId,
  subject,
  messages,
  count,
  labels,
  sentiment,
  onRemoveLabel,
}: ThreadOverviewProps) {
  const { t } = useTranslation();
  return toElement(
    VStack(
      HStack(
        LChip(LText(t('ui.message.conversationMessages', { count }))).testID('thread-count'),
        Embed(sentiment && <SentimentIndicator sentiment={sentiment} size="medium" showLabel />),
      )
        .wrap()
        .align('center')
        .spacing('sm'),
      VStack(
        Embed(
          <Text variant="display-4-medium" role="heading" aria-level={1} testID="thread-subject">
            {subject}
          </Text>,
        ),
      ).frame({ width: 'full', maxWidth: '672' }),
      labels.length > 0
        ? HStack(
            Embed(
              labels.map((label) => (
                <Chip key={label._id} variant="subtle" onClose={() => onRemoveLabel(label.name)}>
                  {label.name}
                </Chip>
              )),
            ),
          )
            .wrap()
            .spacing('sm')
        : null,
      Embed(<ThreadSummary messageId={messageId} messages={messages} />),
    )
      .padding('horizontal', 'lg')
      .padding('bottom', '2xl')
      .spacing('lg')
      .testID('thread-overview'),
  );
}
