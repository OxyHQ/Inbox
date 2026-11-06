import { MessageDetailEmpty } from '@/components/MessageDetailEmpty';
import { getShellRoute } from '@/constants/shell-routes';
import { useShellPathname } from '@/hooks/useShellPathname';
import { usePathname } from 'expo-router';
import { type ReactNode, useSyncExternalStore } from 'react';
import { View } from 'react-native';

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/** The empty detail belongs to the shell, so restoring the router cannot restart it. */
export function MailboxRouteOutlet({ children }: { children: ReactNode }) {
  const route = getShellRoute(usePathname());
  const emptyDetail = getShellRoute(useShellPathname()).emptyDetail;
  const hydrated = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  return (
    <>
      {emptyDetail && <MessageDetailEmpty />}
      {/* Keep the navigator mounted for route effects and retained drafts. List
          routes have no detail UI, so their flex wrappers must not consume space. */}
      <View className={emptyDetail ? 'hidden' : 'flex-1'}>
        {hydrated || route.renderRoute ? children : null}
      </View>
    </>
  );
}
