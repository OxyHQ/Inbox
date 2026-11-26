import { useOxy } from '@oxy.so/services/ui/client';
import { useCallback, useSyncExternalStore } from 'react';
import { inboxAccountCache } from '@/hooks/queries/inboxAccountCache';

/**
 * Whether the signed-in account's cached mail is restored, for THIS render's
 * account: the readiness `useOxy().isAccountCacheReady` gave before Services
 * 15 (which dropped it with its React Query cache). Private reads and the
 * private boundary wait on it, so a cache still holding (or restoring) another
 * account never reads as ready. Signed out it is true, as it was.
 */
export function useAccountCacheReady(): boolean {
  const { user } = useOxy();
  const accountId = user?.id ?? null;
  const read = useCallback(() => inboxAccountCache.isReadyFor(accountId), [accountId]);
  return useSyncExternalStore(inboxAccountCache.subscribe, read, read);
}
