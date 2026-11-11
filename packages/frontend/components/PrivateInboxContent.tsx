import { RequireOxyAuth } from '@oxy.so/services/ui';
import { OxySignInButton, useOxy } from '@oxy.so/services/ui/client';
import { EmptyState } from '@oxy.so/bloom/empty-state';
import { Image } from 'expo-image';
import { Fragment, type ReactNode } from 'react';
import { View } from 'react-native';
import { useTranslation } from '@/lib/i18n';

/** Private content resets with its account; surrounding page chrome stays mounted. */
export function PrivateInboxContent({ children }: { children: ReactNode }) {
  const { user, canUsePrivateApi, isAccountCacheReady } = useOxy();
  const { t } = useTranslation();
  const scope = canUsePrivateApi && isAccountCacheReady ? user?.id : null;
  return (
    <RequireOxyAuth
      loadingFallback={<View />}
      signedOutFallback={
        <View className="flex-1 justify-center">
          <EmptyState
            illustration={
              <Image
                source={require('@/assets/images/welcome-compose.png')}
                style={{ width: 240, height: 240 }}
                contentFit="contain"
                accessible={false}
              />
            }
            title={t('auth.gate.title')}
            description={t('auth.gate.subtitle')}
            footer={<OxySignInButton variant="contained" />}
          />
        </View>
      }
    >
      <Fragment key={scope}>{children}</Fragment>
    </RequireOxyAuth>
  );
}
