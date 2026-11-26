import { useOxy } from '@oxy.so/services/ui/client';
import { useAccountCacheReady } from '@/hooks/useAccountCacheReady';
import { useMemo } from 'react';
import { createEmailApi } from '@/services/emailApi';

/** The SDK owns readiness; queries do not wait for a component effect to create a client. */
export function useEmailApi() {
  const { oxyServices, user, canUsePrivateApi } = useOxy();
  const isAccountCacheReady = useAccountCacheReady();
  const accountId = user?.id ?? null;
  const ready = canUsePrivateApi && isAccountCacheReady && accountId !== null;
  const http = oxyServices.http;
  return useMemo(
    () => (ready && accountId ? createEmailApi(http) : null),
    [ready, http, accountId],
  );
}
