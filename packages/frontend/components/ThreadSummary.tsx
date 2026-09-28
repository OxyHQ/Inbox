import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@oxy.so/bloom/accordion';
import { Badge } from '@oxy.so/bloom/badge';
import { Button } from '@oxy.so/bloom/button';
import { Card, CardHeader, CardTitle, CardBody } from '@oxy.so/bloom/card';
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
  minMessages = 4,
}: ThreadSummaryProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const { summary, keyPoints, actionItems, isLoading, error, refetch } =
    useThreadSummary(messageId, messages, { minMessages });
  if (messages.length < minMessages) return null;
  if (isLoading) return <Loading text={t('threadSummary.title')} />;
  if (error)
    return (
      <Card appearance="outline">
        <CardHeader>
          <CardTitle>{t('threadSummary.title')}</CardTitle>
        </CardHeader>
        <CardBody>
          <Text>{t('threadSummary.unavailable')}</Text>
          <Button appearance="subtle" onPress={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </CardBody>
      </Card>
    );
  if (!summary && keyPoints.length === 0 && actionItems.length === 0)
    return null;
  return (
    <Accordion
      value={expanded ? 'summary' : undefined}
      onValueChange={(value) => setExpanded(value === 'summary')}
    >
      <AccordionItem value="summary">
        <AccordionTrigger icon={<RiSparklingLine />}>
          {t('threadSummary.title')}
        </AccordionTrigger>
        <AccordionContent>
          <Badge
            tone="neutral"
            appearance="subtle"
            content={t('threadSummary.messages', { count: messages.length })}
            size="label-small"
          />
          <View className="gap-3">
            {summary && <Text selectable>{summary}</Text>}
            {keyPoints.length > 0 && (
              <View className="gap-2">
                <Text variant="caption-1-medium">
                  {t('threadSummary.keyPoints')}
                </Text>
                {keyPoints.map((point, index) => (
                  <Text key={index} selectable>
                    • {point}
                  </Text>
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
                    {item.owner && (
                      <Text variant="caption-1-regular">{item.owner}</Text>
                    )}
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
  );
}
