import { useTranslation } from '@/lib/i18n';
import { EmptyState } from '@oxy.so/bloom/empty-state';
import { RiMailLine } from '@oxy.so/bloom/icons';
import { View } from 'react-native';
export function MessageDetailEmpty() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 justify-center">
      <EmptyState icon={RiMailLine} title={t('empty.selectConversation')} />
    </View>
  );
}
