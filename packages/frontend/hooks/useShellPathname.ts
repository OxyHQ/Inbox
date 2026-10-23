import { usePathname } from 'expo-router';
import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const getServerSnapshot = () => '/';

/** Deep links hydrate the exported index shell before applying their live route. */
export function useShellPathname() {
  const pathname = usePathname();
  return useSyncExternalStore(subscribe, () => pathname, getServerSnapshot);
}
