import { useTranslation } from '@/lib/i18n';
import { AppShell } from '@oxy.so/bloom/app-shell';
import { EmptyState } from '@oxy.so/bloom/empty-state';
import { EmptyStateSticker } from '@/components/EmptyStateSticker';
import { Stack, useRouter } from 'expo-router';

export default function NotFoundScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AppShell header={null} contentMaxWidth="none" safeArea>
        <EmptyState
          illustration={<EmptyStateSticker name="notFound" />}
          title={t('ui.message.notFound')}
          description={t('notFound.title')}
          action={{
            label: t('notFound.back'),
            onPress: () => router.replace('/'),
          }}
        />
      </AppShell>
    </>
  );
}
