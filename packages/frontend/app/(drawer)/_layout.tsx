import { SearchFocusProvider } from "@/contexts/search-focus-context";
import { InboxSettingsProvider } from "@/components/settings/InboxSettings";
import { Slot } from "expo-router";
import { useEffect } from "react";
import { MailboxShell } from "@/components/MailboxShell";
import { useOxy } from "@oxy.so/services";
import { useEmailStore } from "@/hooks/useEmail";

export default function DrawerLayout() {
  const { isAuthenticated, oxyServices } = useOxy();
  const _initApi = useEmailStore((s) => s._initApi);
  const hasApi = useEmailStore((s) => s._api !== null);
  // Initialize email API with httpService when authenticated.
  // Also re-initializes after an account switch resets the store (_api becomes null).
  // Deps deliberately exclude `oxyServices` (object identity changes on every
  // render) and `_initApi` (stable zustand action); the effect reads them
  // imperatively from the closure when triggered.
  useEffect(() => {
    if (hasApi) return;
    if (!isAuthenticated) return;
    _initApi(oxyServices.httpService);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, hasApi]);

  return (
    <SearchFocusProvider>
      <InboxSettingsProvider>
        <MailboxShell>
          <Slot />
        </MailboxShell>
      </InboxSettingsProvider>
    </SearchFocusProvider>
  );
}
