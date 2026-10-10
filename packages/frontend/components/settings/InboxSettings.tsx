/** App settings are pages of Bloom's modal; Bloom owns navigation, scrolling and responsive chrome. */
import { useTranslation } from '@/lib/i18n';
import { useDialogControl } from '@oxy.so/bloom/dialog';
import { RiAccountCircleLine } from '@oxy.so/bloom/icons';
import { SettingsModal } from '@oxy.so/bloom/settings-modal';
import { useOxy } from '@oxy.so/services';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { noteSettingsOpen } from '@/lib/notifications/new-mail-attention';
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
      // The modal covers the mail list: new mail is announced while it is up.
      noteSettingsOpen(true);
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
          noteSettingsOpen(false);
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
    </SettingsContext.Provider>
  );
}
