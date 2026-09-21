jest.mock('@/components/InboxBottomBar', () => ({
  InboxBottomBar: () => null,
}));
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MailboxShell } from '@/components/MailboxShell';
import { SPECIAL_USE } from '@/constants/mailbox';

jest.mock('@/components/settings/InboxSettings', () => ({
  useInboxSettings: () => jest.fn(),
}));

const mockPush = jest.fn();
const mockCreate = jest.fn();
const mockDelete = jest.fn();
const mockToggle = jest.fn();
let mockPath = '/';
let mockAuthenticated = true;
let mockShell: any;
let mockState: any;
const mockMailboxes = [
  {
    _id: 'inbox-id',
    name: 'Inbox',
    specialUse: SPECIAL_USE.INBOX,
    unseenMessages: 4,
  },
  {
    _id: 'sent-id',
    name: 'Sent',
    specialUse: SPECIAL_USE.SENT,
    unseenMessages: 0,
  },
  { _id: 'custom-id', name: 'Invoices', unseenMessages: 2 },
];
jest.mock('react-native', () => ({
  View: ({ children }: any) => <div>{children}</div>,
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPath,
}));
jest.mock('@oxy.so/bloom/app-shell', () => ({
  AppShell: (props: any) => {
    mockShell = props;
    return (
      <div>
        {props.children}
        {props.sidebar.footer({ collapsed: false })}
      </div>
    );
  },
}));
jest.mock(
  '@oxy.so/bloom/icons',
  () => new Proxy({}, { get: () => () => null }),
);
jest.mock('@oxy.so/bloom/dialog', () => ({
  useDialogControl: () => ({ open: jest.fn(), close: jest.fn() }),
  Dialog: ({ children, actions }: any) => (
    <div>
      {children}
      {actions?.map((action: any) => (
        <button key={action.label} onClick={action.onPress}>
          {action.label}
        </button>
      ))}
    </div>
  ),
}));
jest.mock('@oxy.so/bloom/button', () => ({
  Button: ({ children, onPress, disabled }: any) => (
    <button disabled={disabled} onClick={onPress}>
      {children}
    </button>
  ),
}));
jest.mock('@oxy.so/bloom/text-field', () => ({
  TextFieldInput: ({ label, value, onChangeText }: any) => (
    <input
      aria-label={label}
      value={value}
      onChange={(event) => onChangeText(event.target.value)}
    />
  ),
}));
jest.mock('@oxy.so/services', () => ({
  useOxy: () => ({ isAuthenticated: mockAuthenticated }),
  ProfileButton: () => (
    <button>{mockAuthenticated ? 'Account' : 'Sign in'}</button>
  ),
  OxySignInButton: () => <button>Sign in</button>,
  openAccountDialog: jest.fn(),
}));
jest.mock('@/constants/theme', () => ({
  useColors: () => ({ primary: 'purple' }),
}));
jest.mock('@/assets/logo', () => ({ LogoIcon: () => null }));
jest.mock('@/hooks/useIsDesktopLayout', () => ({ DESKTOP_BREAKPOINT: 900 }));
jest.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/hooks/queries/useMailboxes', () => ({
  useMailboxes: () => ({ data: mockMailboxes }),
}));
jest.mock('@/hooks/queries/useLabels', () => ({
  useLabels: () => ({
    data: [{ _id: 'label-id', name: 'Receipts', color: '#123456' }],
  }),
}));
jest.mock('@/hooks/mutations/useMailboxMutations', () => ({
  useCreateMailbox: () => ({ mutate: mockCreate }),
  useDeleteMailbox: () => ({ mutate: mockDelete }),
}));
jest.mock('@/hooks/useEmail', () => ({
  useEmailStore: Object.assign((selector: any) => selector(mockState), {
    getState: () => mockState,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthenticated = true;
  mockPath = '/';
  mockState = {
    sidebarCollapsed: false,
    moreExpanded: false,
    toggleMore: jest.fn(),
    toggleSidebar: mockToggle,
  };
});

it('routes system mailboxes, custom folders, labels and compose without changing IDs', () => {
  render(
    <MailboxShell>
      <span>Message workspace</span>
    </MailboxShell>,
  );
  for (const [key, expected] of [
    ['inbox-id', '/'],
    [
      'sent-id',
      { pathname: '/(drawer)/(tabs)/(inbox)/[view]', params: { view: 'sent' } },
    ],
    [
      'custom-id',
      {
        pathname: '/(drawer)/(tabs)/(inbox)/[view]',
        params: { view: 'custom-id' },
      },
    ],
    [
      'label:receipts',
      {
        pathname: '/(drawer)/(tabs)/(inbox)/label/[name]',
        params: { name: 'receipts' },
      },
    ],
  ]) {
    act(() =>
      mockShell.sidebar.items.find((item: any) => item.key === key).onPress(),
    );
    expect(mockPush).toHaveBeenLastCalledWith(expected);
  }
  act(() => mockShell.sidebar.primaryAction.onPress());
  expect(mockPush).toHaveBeenLastCalledWith('/compose');
  expect(screen.getByRole('button', { name: 'Account' })).toBeTruthy();
});

it('retains folder create and long-press delete mutations and a keyboard-accessible delete entry', () => {
  render(<MailboxShell>{null}</MailboxShell>);
  fireEvent.change(screen.getByLabelText('ui.drawer.folderName'), {
    target: { value: '  Work  ' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'ui.drawer.createFolderButton' }),
  );
  expect(mockCreate).toHaveBeenCalledWith({ name: 'Work' }, expect.any(Object));
  act(() =>
    mockShell.sidebar.items
      .find((item: any) => item.key === 'custom-id')
      .onLongPress(),
  );
  fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));
  expect(mockDelete).toHaveBeenCalledWith(
    { mailboxId: 'custom-id' },
    expect.any(Object),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'common.delete · Invoices' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));
  expect(mockDelete).toHaveBeenCalledTimes(2);
});

it('selects label destinations and leaves auth-only actions absent when signed out', () => {
  mockPath = '/label/receipts';
  const view = render(<MailboxShell>{null}</MailboxShell>);
  expect(mockShell.sidebar.selected).toBe('label:receipts');
  mockAuthenticated = false;
  view.rerender(<MailboxShell>{null}</MailboxShell>);
  expect(mockShell.sidebar.items).toEqual([]);
  expect(mockShell.sidebar.primaryAction).toBeUndefined();
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
});
