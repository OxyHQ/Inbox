/** BloomProvider owns the shared tab-bar, scroll and bottom-edge state. */

import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import { Tabs } from 'expo-router/tabs';
import { useExpandTabBar } from '@oxy.so/bloom/tab-bar';

import { InboxTabBar } from '@/components/InboxTabBar';
import { SearchFocusProvider } from '@/contexts/search-focus-context';

/** Every route starts with fully visible navigation, including retained tab stacks. */
function ResetTabBarOnRouteChange() {
  const pathname = usePathname();
  const expandTabBar = useExpandTabBar();

  useEffect(() => {
    expandTabBar();
  }, [expandTabBar, pathname]);

  return null;
}

export default function TabsLayout() {
  return (
    <>
      <ResetTabBarOnRouteChange />
      <SearchFocusProvider>
        <Tabs tabBar={(props) => <InboxTabBar {...props} />} screenOptions={{ headerShown: false }}>
          <Tabs.Screen name="(inbox)" />
          <Tabs.Screen name="search" />
          <Tabs.Screen name="settings" />
          <Tabs.Screen name="subscriptions" options={{ href: null }} />
        </Tabs>
      </SearchFocusProvider>
    </>
  );
}
