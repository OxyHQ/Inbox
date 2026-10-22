import { RequireOxyAuth } from '@oxy.so/services/ui';
import { useOxy } from '@oxy.so/services/ui/client';
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
      title={t('auth.gate.title')}
      subtitle={t('auth.gate.subtitle')}
    >
      <Fragment key={scope}>{children}</Fragment>
    </RequireOxyAuth>
  );
}
