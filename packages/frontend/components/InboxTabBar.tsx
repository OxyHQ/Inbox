import { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { TabBar, TabBarButton, type TabBarItem } from '@oxy.so/bloom/tab-bar';
import {
  MagnifyingGlass_Filled_Stroke2_Corner0_Rounded,
  MagnifyingGlass_Stroke2_Corner0_Rounded,
  SettingsGear2_Filled_Corner0_Rounded,
  SettingsGear2_Stroke2_Corner0_Rounded,
} from '@oxy.so/bloom/icons';
import type { BottomTabBarProps } from 'expo-router/tabs';

import { useSearchFocus } from '@/contexts/search-focus-context';
import { useIsDesktopLayout } from '@/hooks/useIsDesktopLayout';
import { useTranslation } from '@/lib/i18n';
import { UpcomingFilledIcon, UpcomingOutlineIcon } from '@/components/icons/MailActionIcons';

const TAB_ROUTES = ['(inbox)', 'search', 'settings'] as const;
const ICON_SIZE = 'md';
const TAB_BAR_MAX_WIDTH = 440;

export function InboxTabBar({ state, navigation }: BottomTabBarProps) {
  const { t } = useTranslation();
  const isDesktopLayout = useIsDesktopLayout();
  const keyboardVisible = useKeyboardState((keyboard) => keyboard.isVisible);

  const items = useMemo<TabBarItem[]>(
    () => [
      {
        name: '(inbox)',
        label: t('tabs.inbox'),
        icon: <UpcomingOutlineIcon />,
        activeIcon: <UpcomingFilledIcon />,
      },
      {
        name: 'search',
        label: t('tabs.search'),
        icon: <MagnifyingGlass_Stroke2_Corner0_Rounded size={ICON_SIZE} />,
        activeIcon: <MagnifyingGlass_Filled_Stroke2_Corner0_Rounded size={ICON_SIZE} />,
      },
      {
        name: 'settings',
        label: t('tabs.settings'),
        icon: <SettingsGear2_Stroke2_Corner0_Rounded size={ICON_SIZE} />,
        activeIcon: <SettingsGear2_Filled_Corner0_Rounded size={ICON_SIZE} />,
      },
    ],
    [t],
  );

  const focusedRouteName = state.routes[state.index]?.name;
  const activeIndex = TAB_ROUTES.findIndex((name) => name === focusedRouteName);

  const { focusInput } = useSearchFocus();

  const handleIndexChange = useCallback(
    (index: number) => {
      const route = TAB_ROUTES[index];
      if (route === undefined) return;

      navigation.navigate(route);

      if (route === 'search') {
        focusInput();
      }
    },
    [navigation, focusInput],
  );

  if (isDesktopLayout || keyboardVisible) return null;

  return (
    <View style={styles.host}>
      <TabBar
        activeIndex={activeIndex}
        onIndexChange={handleIndexChange}
        maxWidth={TAB_BAR_MAX_WIDTH}
      >
        {items.map((item, index) => (
          <TabBarButton key={item.name} item={item} index={index} />
        ))}
      </TabBar>
    </View>
  );
}

InboxTabBar.displayName = 'InboxTabBar';

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'box-none',
  },
});
