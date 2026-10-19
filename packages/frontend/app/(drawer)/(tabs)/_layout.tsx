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

  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger — the bar re-expands on every route change.
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
        {/*
          Every child route is declared, and none with `href: null`. On
          expo-router 58 a Tabs child that is undeclared, or declared with
          `href: null`, does not render when its URL is loaded: the navigator
          silently shows its first tab instead. There is no tab bar here
          (`tabBar` renders nothing), so `href: null` hid nothing anyway.
          __tests__/navigation/navigator-declarations.test.ts holds this.
        */}
        <Tabs.Screen name="(inbox)" />
        <Tabs.Screen name="search" />
        <Tabs.Screen name="settings/index" />
        <Tabs.Screen name="settings/about" />
        <Tabs.Screen name="settings/account" />
        <Tabs.Screen name="settings/advanced" />
        <Tabs.Screen name="settings/ai" />
        <Tabs.Screen name="settings/appearance" />
        <Tabs.Screen name="settings/contacts" />
        <Tabs.Screen name="settings/inbox-prefs" />
        <Tabs.Screen name="settings/labels" />
        <Tabs.Screen name="settings/notifications" />
        <Tabs.Screen name="settings/privacy" />
        <Tabs.Screen name="settings/storage" />
        <Tabs.Screen name="subscriptions" />
      </Tabs>
    </>
  );
}

// A failure in this section stays in this section.
export { RouteErrorBoundary as ErrorBoundary } from '@/components/RouteErrorBoundary';
