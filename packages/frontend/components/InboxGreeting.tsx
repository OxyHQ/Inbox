import { useInboxPrefs } from '@/contexts/inbox-prefs-context';
import { useDailyBrief } from '@/hooks/queries/useDailyBrief';
import { useTranslation } from '@/lib/i18n';
import type { Message } from '@/services/emailApi';
import { Button } from '@oxy.so/bloom/button';
import { Card, CardBody } from '@oxy.so/bloom/card';
import { Text } from '@oxy.so/bloom/typography';
import { View } from 'react-native';
/** Mounted only when the reader asks for a brief, never ahead of the mail by default. */
export function InboxGreeting({ messages }: { messages: Message[] }) {
  const { prefs } = useInboxPrefs();
  const { t } = useTranslation();
  const { briefText, isLoading, isStreaming, error, regenerate } =
    useDailyBrief({ enabled: prefs.aiBrief, autoGenerate: true });
  return (
    <View className="px-3 pb-3">
      <Card>
        <CardBody>
          <Text>
            {briefText ||
              t(
                error
                  ? 'home.brief.failed'
                  : isLoading || isStreaming
                    ? 'home.brief.writing'
                    : messages.length
                      ? 'home.brief.preparing'
                      : 'home.brief.nothingNew',
              )}
          </Text>
          {error && (
            <Button appearance="subtle" onPress={regenerate}>
              {t('common.retry')}
            </Button>
          )}
        </CardBody>
      </Card>
    </View>
  );
}
