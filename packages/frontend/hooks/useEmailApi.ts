import { useOxy } from '@oxy.so/services/ui/client';
import { useMemo } from 'react';
import { createEmailApi } from '@/services/emailApi';

/** The SDK owns readiness; queries do not wait for a component effect to create a client. */
export function useEmailApi() {
  const { oxyServices, user, canUsePrivateApi, isAccountCacheReady } = useOxy();
  const accountId = user?.id ?? null;
  const ready = canUsePrivateApi && isAccountCacheReady && accountId !== null;
  const http = oxyServices.http;
  return useMemo(
    () => (ready && accountId ? createEmailApi(http) : null),
    [ready, http, accountId],
  );
}
