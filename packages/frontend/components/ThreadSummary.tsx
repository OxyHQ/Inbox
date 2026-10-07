import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@oxy.so/bloom/accordion';
import { Divider } from '@oxy.so/bloom/divider';
import { RiSparklingLine } from '@oxy.so/bloom/icons';
import { Loading } from '@oxy.so/bloom/loading';
import { Text } from '@oxy.so/bloom/typography';
import { useState } from 'react';
import { View } from 'react-native';
import { useThreadSummary } from '@/hooks/queries/useThreadSummary';
import { useTranslation } from '@/lib/i18n';
import type { Message } from '@/services/emailApi';

interface ThreadSummaryProps {
  messageId: string;
  messages: Message[];
  minMessages?: number;
}

export function ThreadSummary({
  messageId,
  messages,
  minMessages = 1,
}: ThreadSummaryProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const { summary, keyPoints, actionItems, isLoading, error } =
    useThreadSummary(messageId, messages, { minMessages });
  if (messages.length < minMessages) return null;
  if (isLoading) return <Loading text={t('threadSummary.title')} />;
  if (error || (!summary.trim() && keyPoints.length === 0 && actionItems.length === 0))
    return null;
  return (
    <View className="w-full max-w-3xl">
      <Accordion
        value={expanded ? 'summary' : undefined}
        onValueChange={(value) => setExpanded(value === 'summary')}
      >
        <AccordionItem value="summary">
          <AccordionTrigger icon={<RiSparklingLine />}>
            {t('threadSummary.title')}
          </AccordionTrigger>
          <AccordionContent>
            <View className="gap-3">
              {summary && <Text selectable>{summary}</Text>}
              {keyPoints.length > 0 && (
                <View className="gap-2">
                  <Text variant="caption-1-medium">
                    {t('threadSummary.keyPoints')}
                  </Text>
                  {keyPoints.map((point, index) => (
                    <Text key={index} selectable>• {point}</Text>
                  ))}
                </View>
              )}
              {actionItems.length > 0 && (
                <View className="gap-2">
                  <Divider />
                  <Text variant="caption-1-medium">
                    {t('threadSummary.actionItems')}
                  </Text>
                  {actionItems.map((item, index) => (
                    <View key={index} className="gap-1">
                      <Text selectable>{item.text}</Text>
                      {item.owner && <Text variant="caption-1-regular">{item.owner}</Text>}
                      {item.deadline && (
                        <Text variant="caption-1-regular">
                          {t('threadSummary.due', { date: item.deadline })}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </View>
  );
}
