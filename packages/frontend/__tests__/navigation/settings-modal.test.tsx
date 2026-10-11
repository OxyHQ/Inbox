import { InboxSettingsProvider, useInboxSettings } from '@/components/settings/InboxSettings';
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

const mockOpen = jest.fn();
const mockShowAccount = jest.fn();
let mockAuthenticated = true;
/** What the suite reads from the props InboxSettings hands Bloom's SettingsModal. */
interface ModalProps {
  initialView?: string;
  page?: string;
  pages: Record<string, unknown>;
  groups: { items: { key: string; onPress: () => void }[] }[];
  onClose: () => void;
}
let mockModal: ModalProps | null = null;
/** The modal's last props; fails the test if the modal was not rendered. */
function mockModalProps(): ModalProps {
  if (!mockModal) throw new Error('the settings modal was not rendered');
  return mockModal;
}
jest.mock('@oxy.so/services', () => ({
  useOxy: () => ({
    isAuthenticated: mockAuthenticated,
    showBottomSheet: mockShowAccount,
  }),
}));
jest.mock('@oxy.so/bloom/icons', () => new Proxy({}, { get: () => () => null }));
jest.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@oxy.so/bloom/dialog', () => ({
  useDialogControl: () =>
    React.useMemo(
      () => ({
        ref: React.createRef(),
        open: () =>
          mockOpen({
            initialView: mockModalProps().initialView,
            page: mockModalProps().page,
          }),
        close: jest.fn(),
      }),
      [],
    ),
}));
jest.mock('@oxy.so/bloom/settings-modal', () => ({
  SettingsModal: (props: ModalProps) => {
    mockModal = props;
    return null;
  },
}));
jest.mock('@/components/settings/sections/AccountSection', () => ({
  AccountSection: () => null,
}));
jest.mock('@/components/settings/sections/AppearanceSection', () => ({
  AppearanceSection: () => null,
}));
jest.mock('@/components/settings/sections/NotificationsSection', () => ({
  NotificationsSection: () => null,
}));
jest.mock('@/components/settings/sections/InboxPrefsSection', () => ({
  InboxPrefsSection: () => null,
}));
jest.mock('@/components/settings/sections/PrivacySection', () => ({
  PrivacySection: () => null,
}));
jest.mock('@/components/settings/sections/LabelsSection', () => ({
  LabelsSection: () => null,
}));
jest.mock('@/components/settings/sections/ContactsSection', () => ({
  ContactsSection: () => null,
}));
jest.mock('@/components/settings/sections/AISection', () => ({
  AISection: () => null,
}));
jest.mock('@/components/settings/sections/StorageSection', () => ({
  StorageSection: () => null,
}));
jest.mock('@/components/settings/sections/AdvancedSection', () => ({
  AdvancedSection: () => null,
}));
jest.mock('@/components/settings/sections/AboutSection', () => ({
  AboutSection: () => null,
}));

function Actions() {
  const open = useInboxSettings();
  return (
    <>
      <button type="button" onClick={() => open()}>
        Settings
      </button>
      <button type="button" onClick={() => open('account')}>
        Account link
      </button>
    </>
  );
}
beforeEach(() => {
  mockOpen.mockClear();
  mockShowAccount.mockClear();
  mockAuthenticated = true;
});
it('commits initialView and page before opening deep links, including after ordinary navigation', () => {
  render(
    <InboxSettingsProvider>
      <Actions />
    </InboxSettingsProvider>,
  );
  fireEvent.click(screen.getByText('Settings'));
  expect(mockOpen).toHaveBeenLastCalledWith({
    initialView: 'navigation',
    page: 'appearance',
  });
  fireEvent.click(screen.getByText('Account link'));
  expect(mockOpen).toHaveBeenLastCalledWith({
    initialView: 'page',
    page: 'account',
  });
  fireEvent.click(screen.getByText('Settings'));
  fireEvent.click(screen.getByText('Account link'));
  expect(mockOpen).toHaveBeenCalledTimes(4);
  expect(mockOpen).toHaveBeenLastCalledWith({
    initialView: 'page',
    page: 'account',
  });
});
it('excludes private pages and rejects a private deep link while signed out', () => {
  mockAuthenticated = false;
  render(
    <InboxSettingsProvider>
      <Actions />
    </InboxSettingsProvider>,
  );
  fireEvent.click(screen.getByText('Account link'));
  expect(mockModalProps().pages.account).toBeUndefined();
  expect(mockModalProps().groups[0].items.some((item) => item.key === 'account')).toBe(false);
  expect(mockOpen).toHaveBeenLastCalledWith({
    initialView: 'page',
    page: 'appearance',
  });
});
it('opens the SDK account surface only after the settings exit finishes', () => {
  render(
    <InboxSettingsProvider>
      <Actions />
    </InboxSettingsProvider>,
  );
  act(() => mockModalProps().groups[1].items[0].onPress());
  expect(mockShowAccount).not.toHaveBeenCalled();
  act(() => mockModalProps().onClose());
  expect(mockShowAccount).toHaveBeenCalledWith('ManageAccount');
  act(() => mockModalProps().onClose());
  expect(mockShowAccount).toHaveBeenCalledTimes(1);
});
