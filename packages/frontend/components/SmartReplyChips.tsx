/**
 * Smart Reply Chips component.
 *
 * Displays AI-generated quick reply suggestions as tappable chips.
 * Tapping a chip inserts the text into the reply composer.
 */

import { Button } from '@oxy.so/bloom/button';
import { Chip } from '@oxy.so/bloom/chip';
import { RiSparklingLine } from '@oxy.so/bloom/icons';
import { Loading } from '@oxy.so/bloom/loading';
import { Text } from '@oxy.so/bloom/typography';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { useInboxPrefs } from '@/contexts/inbox-prefs-context';
import { useSmartReplies } from '@/hooks/queries/useSmartReplies';
import type { Message } from '@/services/emailApi';
import { useTranslation } from '@/lib/i18n';

interface SmartReplyChipsProps {
  message: Message;
  onSelectReply: (text: string) => void;
}

export function SmartReplyChips({ message, onSelectReply }: SmartReplyChipsProps) {
  const { t } = useTranslation();
  const { prefs } = useInboxPrefs();
  const [hasRequestedReplies, setHasRequestedReplies] = useState(false);
  const { replies, isLoading, refetch } = useSmartReplies(message);

  const handleGenerateReplies = useCallback(() => {
    setHasRequestedReplies(true);
    void refetch();
  }, [refetch]);

  // Smart Reply is opt-in; render nothing when the user disabled it.
  if (!prefs.aiSmartReply) {
    return null;
  }

  if (!hasRequestedReplies) {
    return (
      <View className="gap-2">
        <Button appearance="subtle" leading={<RiSparklingLine />} onPress={handleGenerateReplies}>
          {t('smartReply.generate')}
        </Button>
        <Text variant="caption-1-regular">{t('smartReply.notice')}</Text>
      </View>
    );
  }
  if (!isLoading && replies.length === 0) return null;
  return (
    <View className="gap-2">
      <Text variant="caption-1-regular">{t('smartReply.quickReplies')}</Text>
      <View className="flex-row flex-wrap gap-2">
        {isLoading ? (
          <Loading text={t('smartReply.generating')} />
        ) : (
          replies.map((reply, index) => (
            <Chip
              key={index}
              appearance="subtle"
              tone="accent"
              onPress={() => onSelectReply(reply)}
            >
              {reply}
            </Chip>
          ))
        )}
      </View>
    </View>
  );
}
