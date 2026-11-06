import { getShellRoute } from '@/constants/shell-routes';
import { usePathname } from 'expo-router';
import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/** Hydrate the public route family selected by the asset Worker, then use the live URL. */
export function useShellPathname() {
  const pathname = usePathname();
  return useSyncExternalStore(
    subscribe,
    () => pathname,
    () => getShellRoute(pathname).pathname,
  );
}
