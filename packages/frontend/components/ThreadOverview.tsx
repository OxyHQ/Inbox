import { Chip } from '@oxy.so/bloom/chip';
import { Text } from '@oxy.so/bloom/typography';
import { View } from 'react-native';
import { SentimentIndicator } from '@/components/SentimentIndicator';
import { ThreadSummary } from '@/components/ThreadSummary';
import type { SentimentResult } from '@/hooks/queries/useSentimentAnalysis';
import { useTranslation } from '@/lib/i18n';
import type { Message } from '@/services/emailApi';

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
  return (
    <View className="gap-4 px-4 pb-6" testID="thread-overview">
      <View className="flex-row flex-wrap items-center gap-2">
        <Chip testID="thread-count">
          {t('ui.message.conversationMessages', { count })}
        </Chip>
        {sentiment && <SentimentIndicator sentiment={sentiment} size="medium" showLabel />}
      </View>
      <View className="w-full max-w-2xl">
        <Text
          variant="display-4-medium"
          role="heading"
          aria-level={1}
          testID="thread-subject"
        >
          {subject}
        </Text>
      </View>
      {labels.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {labels.map((label) => (
            <Chip key={label._id} variant="subtle" onClose={() => onRemoveLabel(label.name)}>
              {label.name}
            </Chip>
          ))}
        </View>
      )}
      <ThreadSummary messageId={messageId} messages={messages} />
    </View>
  );
}
