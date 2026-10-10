import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@oxy.so/bloom/accordion';
import { Button } from '@oxy.so/bloom/button';
import { Divider } from '@oxy.so/bloom/divider';
import { RiSparklingLine } from '@oxy.so/bloom/icons';
import { Loading } from '@oxy.so/bloom/loading';
import { Text } from '@oxy.so/bloom/typography';
import { useState } from 'react';
import { View } from 'react-native';
import { useInboxPrefs } from '@/contexts/inbox-prefs-context';
import { useThreadSummary } from '@/hooks/queries/useThreadSummary';
import { useTranslation } from '@/lib/i18n';
import type { Message } from '@/services/emailApi';

interface ThreadSummaryProps {
  messageId: string;
  messages: Message[];
  minMessages?: number;
}

/**
 * An AI summary of the open conversation, on request. It used to run for every
 * conversation opened, with no setting to stop it, while the AI settings page
 * said only the Daily Brief and Smart Reply used inference. Now it is a button,
 * behind its own preference, and nothing leaves until it is pressed.
 */
export function ThreadSummary({
  messageId,
  messages,
  minMessages = 1,
}: ThreadSummaryProps) {
  const { t } = useTranslation();
  const { prefs } = useInboxPrefs();
  const [expanded, setExpanded] = useState(true);
  // Per conversation: opening another one asks again.
  const [requestedFor, setRequestedFor] = useState<string | null>(null);
  const requested = requestedFor === messageId;
  const { summary, keyPoints, actionItems, isLoading, error } =
    useThreadSummary(messageId, messages, {
      minMessages,
      enabled: prefs.aiThreadSummary && requested,
    });
  if (!prefs.aiThreadSummary || messages.length < minMessages) return null;
  if (!requested) {
    return (
      <View className="w-full max-w-3xl items-start">
        <Button
          appearance="subtle"
          leadingIcon={RiSparklingLine}
          onPress={() => setRequestedFor(messageId)}
        >
          {t('threadSummary.summarize')}
        </Button>
      </View>
    );
  }
  if (isLoading) return <Loading text={t('threadSummary.title')} />;
  // Asked for, so a failure is said rather than the button just vanishing.
  if (error) return <Text>{t('threadSummary.unavailable')}</Text>;
  if (!summary.trim() && keyPoints.length === 0 && actionItems.length === 0)
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
