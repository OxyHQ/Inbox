import { MailboxShell } from '@/components/MailboxShell';
import { InboxSettingsProvider } from '@/components/settings/InboxSettings';
import { SearchFocusProvider } from '@/contexts/search-focus-context';
import { SearchSessionProvider } from '@/contexts/search-session-context';
import { Slot } from 'expo-router';

export default function DrawerLayout() {
  return (
    <SearchSessionProvider>
      <SearchFocusProvider>
        <InboxSettingsProvider>
          <MailboxShell>
            <Slot />
          </MailboxShell>
        </InboxSettingsProvider>
      </SearchFocusProvider>
    </SearchSessionProvider>
  );
}
