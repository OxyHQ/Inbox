/** App settings are pages of Bloom's modal; Bloom owns navigation, scrolling and responsive chrome. */
import {
  createContext,
  useCallback,
  useEffect,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { SettingsModal } from '@oxy.so/bloom/settings-modal';
import { useDialogControl } from '@oxy.so/bloom/dialog';
import { useOxy } from '@oxy.so/services';
import { RiAccountCircleLine } from '@oxy.so/bloom/icons';
import { useTranslation } from '@/lib/i18n';
import { SETTINGS_SECTIONS, type SettingsSectionKey } from './sections-catalog';
import { AccountSection } from './sections/AccountSection';
import { AppearanceSection } from './sections/AppearanceSection';
import { NotificationsSection } from './sections/NotificationsSection';
import { InboxPrefsSection } from './sections/InboxPrefsSection';
import { PrivacySection } from './sections/PrivacySection';
import { LabelsSection } from './sections/LabelsSection';
import { ContactsSection } from './sections/ContactsSection';
import { AISection } from './sections/AISection';
import { StorageSection } from './sections/StorageSection';
import { AdvancedSection } from './sections/AdvancedSection';
import { AboutSection } from './sections/AboutSection';
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
const SettingsContext = createContext<
  ((page?: SettingsSectionKey) => void) | null
>(null);
export function useInboxSettings() {
  const open = useContext(SettingsContext);
  if (!open)
    throw new Error('Inbox settings must be used inside InboxSettingsProvider');
  return open;
}
export function InboxSettingsProvider({ children }: { children: ReactNode }) {
  const control = useDialogControl();
  const { isAuthenticated, showBottomSheet } = useOxy();
  const pendingAccount = useRef(false);
  const { t } = useTranslation();
  const [page, setPage] = useState<string>('appearance');
  const [request, setRequest] = useState<{
    sequence: number;
    initialView: 'navigation' | 'page';
  }>({ sequence: 0, initialView: 'navigation' });
  useEffect(() => {
    if (request.sequence) control.open();
  }, [request, control]);
  const open = useCallback(
    (next?: SettingsSectionKey) => {
      const allowed = SETTINGS_SECTIONS.find(
        (section) =>
          section.key === next && (!section.requiresAuth || isAuthenticated),
      );
      setPage(allowed?.key ?? 'appearance');
      setRequest((previous) => ({
        sequence: previous.sequence + 1,
        initialView: next ? 'page' : 'navigation',
      }));
    },
    [isAuthenticated],
  );
  const sections = SETTINGS_SECTIONS.filter(
    (section) => !section.requiresAuth || isAuthenticated,
  );
  const pages = useMemo(
    () =>
      Object.fromEntries(
        SETTINGS_SECTIONS.filter(
          (section) => !section.requiresAuth || isAuthenticated,
        ).map((section) => [
          section.key,
          {
            title: t(section.labelKey),
            content: sectionContent[section.key],
          },
        ]),
      ),
    [t, isAuthenticated],
  );
  return (
    <SettingsContext.Provider value={open}>
      {children}
      <SettingsModal
        initialView={request.initialView}
        control={control}
        onClose={() => {
          if (pendingAccount.current) {
            pendingAccount.current = false;
            showBottomSheet?.('ManageAccount');
          }
        }}
        page={page}
        onPageChange={setPage}
        pages={pages}
        groups={[
          {
            label: 'Inbox',
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
                label: 'Manage Oxy account',
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
    </SettingsContext.Provider>
  );
}
