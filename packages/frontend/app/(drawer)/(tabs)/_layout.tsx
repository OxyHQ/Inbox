/** BloomProvider owns the shared tab-bar, scroll and bottom-edge state. */

import { useExpandTabBar } from '@oxy.so/bloom/tab-bar';
import { usePathname } from 'expo-router';
import { Tabs } from 'expo-router/tabs';
import { useEffect } from 'react';
import { enableScreens } from 'react-native-screens';

// Inactive tabs must detach on web too: transparent scenes otherwise expose
// the previous screen underneath. Detachment preserves drafts and scroll state.
enableScreens();

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
      <Tabs
        detachInactiveScreens
        tabBar={() => null}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Tabs.Screen name="(inbox)" />
        <Tabs.Screen name="search" />
        <Tabs.Screen name="settings/index" options={{ href: null }} />
        <Tabs.Screen name="subscriptions" options={{ href: null }} />
      </Tabs>
    </>
  );
}
