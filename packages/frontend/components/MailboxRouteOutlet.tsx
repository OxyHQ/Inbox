import { MessageDetailEmpty } from '@/components/MessageDetailEmpty';
import { type ReactNode, useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/** Static SPA fallbacks share the index detail until the live router can take over. */
export function MailboxRouteOutlet({ children }: { children: ReactNode }) {
  const hydrated = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  return hydrated ? children : <MessageDetailEmpty />;
}
