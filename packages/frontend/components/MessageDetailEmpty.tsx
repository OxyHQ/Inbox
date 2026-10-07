import { useTranslation } from '@/lib/i18n';
import { EmptyState } from '@oxy.so/bloom/empty-state';
import { EmptyStateSticker } from '@/components/EmptyStateSticker';
import { View } from 'react-native';
export function MessageDetailEmpty() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 justify-center">
      <EmptyState
        illustration={<EmptyStateSticker name="conversation" />}
        title={t('empty.selectConversation')}
        description={t('empty.selectConversationDescription')}
      />
    </View>
  );
}
