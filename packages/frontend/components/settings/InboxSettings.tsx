/** App settings are pages of Bloom's modal; Bloom owns navigation, scrolling and responsive chrome. */
import { useTranslation } from '@/lib/i18n';
import { useDialogControl } from '@oxy.so/bloom/dialog';
import { RiAccountCircleLine } from '@oxy.so/bloom/icons/RiAccountCircleLine';
import { SettingsModal } from '@oxy.so/bloom/settings-modal';
import { useOxy } from '@oxy.so/services/ui/client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { noteSettingsOpen } from '@/lib/notifications/new-mail-attention';
import { useScopedState } from '@/hooks/useScopedState';
import { SETTINGS_SECTIONS, type SettingsSectionKey } from './sections-catalog';
import { AboutSection } from './sections/AboutSection';
import { AccountSection } from './sections/AccountSection';
import { AdvancedSection } from './sections/AdvancedSection';
import { AISection } from './sections/AISection';
import { AppearanceSection } from './sections/AppearanceSection';
import { ContactsSection } from './sections/ContactsSection';
import { InboxPrefsSection } from './sections/InboxPrefsSection';
import { LabelsSection } from './sections/LabelsSection';
import { NotificationsSection } from './sections/NotificationsSection';
import { PrivacySection } from './sections/PrivacySection';
import { StorageSection } from './sections/StorageSection';
const sectionContent = {
  account: <AccountSection />,
  appearance: <AppearanceSection />,
  notifications: <NotificationsSection />,
  'inbox-prefs': <InboxPrefsSection />,
  privacy: <PrivacySection />,
  labels: <LabelsSection />,
  contacts: <ContactsSection />,
  ai: <AISection />,
  storage: <StorageSection />,
  advanced: <AdvancedSection />,
  about: <AboutSection />,
};
const SettingsContext = createContext<((page?: SettingsSectionKey) => void) | null>(null);
export function useInboxSettings() {
  const open = useContext(SettingsContext);
  if (!open) throw new Error('Inbox settings must be used inside InboxSettingsProvider');
  return open;
}
export function InboxSettingsProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, canUsePrivateApi, isAccountCacheReady, isPrivateApiPending } =
    useOxy();
  const accountReady = canUsePrivateApi && isAccountCacheReady && Boolean(user?.id);
  const available = accountReady || (!isAuthenticated && !isPrivateApiPending);
  const scope = accountReady
    ? JSON.stringify(['account', user?.id])
    : available
      ? 'signed-out'
      : 'pending';
  const [request, setRequest] = useScopedState<SettingsRequest>(scope, () => ({
    sequence: 0,
    initialView: 'navigation',
    page: 'appearance',
  }));
  const open = useCallback(
    (next?: SettingsSectionKey) => {
      if (!available) return;
      const allowed = SETTINGS_SECTIONS.find(
        (section) => section.key === next && (!section.requiresAuth || accountReady),
      );
      setRequest((previous) => ({
        sequence: previous.sequence + 1,
        initialView: next ? 'page' : 'navigation',
        page: allowed?.key ?? 'appearance',
      }));
    },
    [available, accountReady, setRequest],
  );
  const setPage = useCallback(
    (page: string) => setRequest((previous) => ({ ...previous, page })),
    [setRequest],
  );
  return (
    <SettingsContext.Provider value={open}>
      {children}
      {available && (
        <SettingsSession
          key={scope}
          request={request}
          isAuthenticated={accountReady}
          setPage={setPage}
        />
      )}
    </SettingsContext.Provider>
  );
}

interface SettingsRequest {
  sequence: number;
  initialView: 'navigation' | 'page';
  page: string;
}

/** Only the overlay resets with identity; the workspace remains mounted. */
function SettingsSession({
  request,
  isAuthenticated,
  setPage,
}: {
  request: SettingsRequest;
  isAuthenticated: boolean;
  setPage: (page: string) => void;
}) {
  const control = useDialogControl();
  const { showBottomSheet } = useOxy();
  const pendingAccount = useRef(false);
  const active = useRef(true);
  const { t } = useTranslation();
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      pendingAccount.current = false;
      noteSettingsOpen(false);
    };
  }, []);
  useEffect(() => {
    if (!request.sequence) return;
    noteSettingsOpen(true);
    control.open();
  }, [request.sequence, control]);
  const sections = SETTINGS_SECTIONS.filter((section) => !section.requiresAuth || isAuthenticated);
  const pages = useMemo(
    () =>
      Object.fromEntries(
        SETTINGS_SECTIONS.filter((section) => !section.requiresAuth || isAuthenticated).map(
          (section) => [
            section.key,
            {
              title: t(section.labelKey),
              content: sectionContent[section.key],
            },
          ],
        ),
      ),
    [t, isAuthenticated],
  );
  return (
    <SettingsModal
      initialView={request.initialView}
      control={control}
      onClose={() => {
        if (!active.current) return;
        noteSettingsOpen(false);
        if (pendingAccount.current) {
          pendingAccount.current = false;
          showBottomSheet?.('ManageAccount');
        }
      }}
      page={request.page}
      onPageChange={setPage}
      pages={pages}
      groups={[
        {
          label: t('app.name'),
          items: sections.map((section) => ({
            key: section.key,
            label: t(section.labelKey),
            icon: section.icon,
            page: section.key,
          })),
        },
        {
          label: 'Oxy',
          items: [
            {
              key: 'oxy-account',
              label: t('ui.settings.manageOxyAccount'),
              icon: RiAccountCircleLine,
              onPress: () => {
                pendingAccount.current = true;
                control.close();
              },
            },
          ],
        },
      ]}
    />
  );
}
