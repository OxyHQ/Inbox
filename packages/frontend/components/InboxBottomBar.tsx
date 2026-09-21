import { useKeyboardState } from 'react-native-keyboard-controller';
import { usePathname, useRouter } from 'expo-router';
import { BottomBar } from '@oxy.so/bloom/bottom-bar';
import { Fab } from '@oxy.so/bloom/fab';
import {
  RiInbox2Line,
  RiSearchLine,
  RiSettings3Line,
  RiEditLine,
} from '@oxy.so/bloom/icons';
import { useOxy } from '@oxy.so/services';
import { useInboxSettings } from '@/components/settings/InboxSettings';
import { useSearchFocus } from '@/contexts/search-focus-context';
import { useEmailStore } from '@/hooks/useEmail';
import { useTranslation } from '@/lib/i18n';

/** Template composition: AppShell positions one BottomBar; its action owns the compose FAB. */
export function InboxBottomBar() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const openSettings = useInboxSettings();
  const { focusInput } = useSearchFocus();
  const { isAuthenticated } = useOxy();
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
      value={pathname.startsWith('/search') ? 'search' : 'inbox'}
      onValueChange={(value) => {
        if (value === 'settings') {
          openSettings();
          return;
        }
        router.navigate(value === 'search' ? '/search' : '/');
        if (value === 'search') focusInput();
      }}
      action={
        isAuthenticated && !selecting ? (
          <Fab
            accessibilityLabel={t('inbox.composeFab')}
            icon={<RiEditLine />}
            label={t('inbox.composeFabLabel')}
            variant="tertiary"
            onPress={() => router.push('/compose')}
          />
        ) : undefined
      }
    />
  );
}
