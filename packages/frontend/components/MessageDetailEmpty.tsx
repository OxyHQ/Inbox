import { useTranslation } from '@/lib/i18n';
import { EmptyState } from '@oxy.so/bloom/empty-state';
import { EmptyStateSticker } from '@/components/EmptyStateSticker';
import { Embed, VStack, toElement } from '@oxy.so/bloom-language';
export function MessageDetailEmpty() {
  const { t } = useTranslation();
  return toElement(
    VStack(
      Embed(
        <EmptyState
          illustration={<EmptyStateSticker name="conversation" />}
          title={t('empty.selectConversation')}
          description={t('empty.selectConversationDescription')}
        />,
      ),
    )
      .flex('1')
      .justify('center'),
  );
}
