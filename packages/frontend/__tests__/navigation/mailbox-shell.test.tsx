jest.mock('@/components/EmptyStateSticker', () => ({ EmptyStateSticker: () => null }));
jest.mock('@/components/InboxList', () => ({
  InboxList: () => <span>Mailbox list</span>,
}));
jest.mock('@/components/SearchList', () => ({ SearchList: () => null }));
jest.mock('@/components/InboxBottomBar', () => ({
  InboxBottomBar: () => null,
}));
import { MailboxShell } from '@/components/MailboxShell';
import { SPECIAL_USE } from '@/constants/mailbox';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

jest.mock('@/components/settings/InboxSettings', () => ({
  useInboxSettings: () => jest.fn(),
}));

const mockPush = jest.fn();
const mockCreate = jest.fn();
const mockDelete = jest.fn();
const mockToggle = jest.fn();
let mockPath = '/';
let mockAuthenticated = true;
let mockSidebar: any;
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
  useWindowDimensions: () => ({ width: 1440, height: 900 }),
  View: ({ children }: any) => <div>{children}</div>,
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPath,
}));
jest.mock('@oxy.so/bloom/content-panel', () => ({
  ContentPanel: ({ children, appearance = 'solid' }: any) => (
    <div data-panel-appearance={appearance}>{children}</div>
  ),
}));
jest.mock('@oxy.so/bloom/styles', () => ({ BREAKPOINTS: { md: 768 } }));
jest.mock('@oxy.so/bloom/app-shell', () => ({
  APP_SHELL_DEFAULTS: { dashboardGutter: 12 },
  AppShell: ({ children, sidebar, bottomBar }: any) => {
    mockSidebar = sidebar;
    return (
      <div>
        {sidebar.footer({ collapsed: false })}
        {children}
        {bottomBar}
      </div>
    );
  },
  AppShellSplitPanes: ({ list, detail, showList, showDetail }: any) => (
    <div>
      {showList && list}
      {showDetail && detail}
    </div>
  ),
}));
jest.mock('@oxy.so/bloom/icons', () => new Proxy({}, { get: () => () => null }));
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
  ProfileButton: () => <button>{mockAuthenticated ? 'Account' : 'Sign in'}</button>,
  OxySignInButton: () => <button>Sign in</button>,
  openAccountDialog: jest.fn(),
}));
jest.mock('@/constants/theme', () => ({
  useColors: () => ({ primary: 'purple' }),
}));
jest.mock('@/assets/logo', () => ({ LogoIcon: () => null }));
jest.mock('@/hooks/useIsDesktopLayout', () => ({
  useIsDesktopLayout: () => true,
}));
// Keys echo back — except the mailbox names, so a test can tell a translated
// name from the raw `specialUse` fallback.
jest.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => (key.startsWith('drawer.mailboxes.') ? `T(${key})` : key),
  }),
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
    ['sent-id', { pathname: '/(drawer)/(tabs)/(inbox)/[view]', params: { view: 'sent' } }],
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
    act(() => mockSidebar.items.find((item: any) => item.key === key).onPress());
    expect(mockPush).toHaveBeenLastCalledWith(expected);
  }
  act(() => mockSidebar.primaryAction.onPress());
  expect(mockPush).toHaveBeenLastCalledWith('/compose');
  expect(screen.getByRole('button', { name: 'Account' })).toBeTruthy();
});

it('retains folder create and long-press delete mutations and a keyboard-accessible delete entry', () => {
  render(<MailboxShell>{null}</MailboxShell>);
  fireEvent.change(screen.getByLabelText('ui.drawer.folderName'), {
    target: { value: '  Work  ' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'ui.drawer.createFolderButton' }));
  expect(mockCreate).toHaveBeenCalledWith({ name: 'Work' }, expect.any(Object));
  act(() => mockSidebar.items.find((item: any) => item.key === 'custom-id').onLongPress());
  fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));
  expect(mockDelete).toHaveBeenCalledWith({ mailboxId: 'custom-id' }, expect.any(Object));
  fireEvent.click(screen.getByRole('button', { name: 'common.delete · Invoices' }));
  fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));
  expect(mockDelete).toHaveBeenCalledTimes(2);
});

it('selects label destinations and leaves auth-only actions absent when signed out', () => {
  mockPath = '/label/receipts';
  const view = render(<MailboxShell>{null}</MailboxShell>);
  expect(mockSidebar.selected).toBe('label:receipts');
  mockAuthenticated = false;
  view.rerender(<MailboxShell>{null}</MailboxShell>);
  expect(mockSidebar.items).toEqual([]);
  expect(mockSidebar.primaryAction).toBeUndefined();
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
});

it('keeps the source mailbox selected while reading a conversation', () => {
  mockPath = '/conversation/message-id';
  mockState.viewMode = { type: 'mailbox', mailbox: mockMailboxes[1] };
  render(<MailboxShell>{null}</MailboxShell>);
  expect(mockSidebar.selected).toBe('sent-id');
});

it('gives subscriptions one solid workspace while preserving the routed navigator state', () => {
  function RetainedRoute() {
    const [draft, setDraft] = useState('');
    return (
      <input
        aria-label="Retained draft"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
    );
  }
  const view = render(
    <MailboxShell>
      <RetainedRoute />
    </MailboxShell>,
  );
  const draft = screen.getByLabelText('Retained draft');
  fireEvent.change(draft, { target: { value: 'Keep my draft' } });
  const appearance = () =>
    draft.closest('[data-panel-appearance]')?.getAttribute('data-panel-appearance');
  expect(appearance()).toBe('plain');
  mockPath = '/subscriptions';
  view.rerender(
    <MailboxShell>
      <RetainedRoute />
    </MailboxShell>,
  );
  expect(screen.queryByText('Mailbox list')).toBeNull();
  expect(screen.getByLabelText('Retained draft')).toBe(draft);
  expect(appearance()).toBe('solid');
  mockPath = '/';
  view.rerender(
    <MailboxShell>
      <RetainedRoute />
    </MailboxShell>,
  );
  expect(screen.getByText('Mailbox list')).toBeTruthy();
  expect((screen.getByLabelText('Retained draft') as HTMLInputElement).value).toBe('Keep my draft');
});

it('names the IMAP \\Junk folder with the Spam key, not a raw "Junk"', () => {
  mockMailboxes.push({
    _id: 'junk-id',
    name: 'Junk',
    specialUse: SPECIAL_USE.SPAM,
    unseenMessages: 0,
  });
  mockState.moreExpanded = true;
  try {
    render(<MailboxShell>{null}</MailboxShell>);
    const junk = mockSidebar.items.find((item: any) => item.key === 'junk-id');
    expect(junk.label).toBe('T(drawer.mailboxes.Spam)');
  } finally {
    mockMailboxes.pop();
  }
});
