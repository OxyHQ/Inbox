import { useTranslation } from '@/lib/i18n';
import { AiChatContainer, AiChatShell } from '@oxy.so/bloom/ai-chat';
import { EmptyState } from '@oxy.so/bloom/empty-state';
import { RiErrorWarningLine } from '@oxy.so/bloom/icons';
import { Stack, useRouter } from 'expo-router';

export default function NotFoundScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AiChatShell sidebar={null} safeArea>
        <AiChatContainer>
          <EmptyState
            icon={RiErrorWarningLine}
            title={t('notFound.title')}
            action={{
              label: t('notFound.back'),
              onPress: () => router.replace('/'),
            }}
          />
        </AiChatContainer>
      </AiChatShell>
    </>
  );
}
