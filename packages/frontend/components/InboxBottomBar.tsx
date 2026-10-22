import { useInboxSettings } from '@/components/settings/InboxSettings';
import { useSearchFocus } from '@/contexts/search-focus-context';
import { useEmailStore } from '@/hooks/useEmail';
import { useTranslation } from '@/lib/i18n';
import { BottomBar } from '@oxy.so/bloom/bottom-bar';
import { Fab } from '@oxy.so/bloom/fab';
import { RiEditLine } from '@oxy.so/bloom/icons/RiEditLine';
import { RiInbox2Line } from '@oxy.so/bloom/icons/RiInbox2Line';
import { RiSearchLine } from '@oxy.so/bloom/icons/RiSearchLine';
import { RiSettings3Line } from '@oxy.so/bloom/icons/RiSettings3Line';
import { useOxy } from '@oxy.so/services/ui/client';
import { usePathname, useRouter } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { useKeyboardState } from 'react-native-keyboard-controller';

const subscribeHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/** Template composition: AppShell positions one BottomBar; its action owns the compose FAB. */
export function InboxBottomBar() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  // Dynamic routes receive the exported index shell. Match its selected tab
  // during hydration, then apply the live route without leaving stale ARIA.
  const hydrated = useSyncExternalStore(subscribeHydration, getClientSnapshot, getServerSnapshot);
  const openSettings = useInboxSettings();
  const { focusInput } = useSearchFocus();
  const { canUsePrivateApi, isAccountCacheReady } = useOxy();
  const accountReady = canUsePrivateApi && isAccountCacheReady;
  const selecting = useEmailStore((state) => state.isSelectionMode);
  const keyboardVisible = useKeyboardState((state) => state.isVisible);
  if (keyboardVisible) return null;
  return (
    <BottomBar
      items={[
        { name: 'inbox', label: t('tabs.inbox'), icon: <RiInbox2Line /> },
        { name: 'search', label: t('tabs.search'), icon: <RiSearchLine /> },
        {
          name: 'settings',
          label: t('tabs.settings'),
          icon: <RiSettings3Line />,
        },
      ]}
      value={hydrated && pathname.startsWith('/search') ? 'search' : 'inbox'}
      onValueChange={(value) => {
        if (value === 'settings') {
          openSettings();
          return;
        }
        router.navigate(value === 'search' ? '/search' : '/');
        if (value === 'search') focusInput();
      }}
      action={
        accountReady && !selecting ? (
          <Fab
            accessibilityLabel={t('inbox.composeFab')}
            icon={RiEditLine}
            label={t('inbox.composeFabLabel')}
            tone="action"
            onPress={() => router.push('/compose')}
          />
        ) : undefined
      }
    />
  );
}
