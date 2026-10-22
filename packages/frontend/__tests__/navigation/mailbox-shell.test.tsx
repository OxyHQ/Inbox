jest.mock('@/components/EmptyStateSticker', () => ({ EmptyStateSticker: () => null }));
jest.mock('@oxy.so/bloom/empty-state', () => ({
  EmptyState: ({
    title,
    description,
    footer,
  }: {
    title: string;
    description: string;
    footer: ReactNode;
  }) => (
    <div>
      <h2>{title}</h2>
      <p>{description}</p>
      {footer}
    </div>
  ),
}));
jest.mock('@/components/InboxList', () => {
  const { PrivateInboxContent } = jest.requireActual('@/components/PrivateInboxContent');
  return {
    InboxList: () => (
      <>
        <h1>Mailbox chrome</h1>
        <PrivateInboxContent>
          <span>Mailbox list</span>
        </PrivateInboxContent>
      </>
    ),
  };
});
jest.mock('@/components/SearchList', () => ({ SearchList: () => null }));
jest.mock('@/components/InboxBottomBar', () => {
  const { useShellPathname } = jest.requireActual('@/hooks/useShellPathname');
  return {
    InboxBottomBar: () => (
      <nav
        aria-label="Mail navigation"
        data-selected={useShellPathname().startsWith('/search') ? 'search' : 'inbox'}
      />
    ),
  };
});
import { MailboxShell } from '@/components/MailboxShell';
import { PrivateInboxContent } from '@/components/PrivateInboxContent';
import { SPECIAL_USE } from '@/constants/mailbox';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { type ReactNode, useState } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { defined } from '../fixtures/defined';
import type { Children, DialogAction, Pressable } from '../fixtures/mockProps';

jest.mock('@/components/settings/InboxSettings', () => ({
  useInboxSettings: () => jest.fn(),
}));

const mockPush = jest.fn();
const mockCreate = jest.fn();
const mockDelete = jest.fn();
const mockToggle = jest.fn();
let mockPath = '/';
let mockDesktop = true;
let mockAuthenticated = true;
let mockTokenReady = true;
let mockCacheReady = true;
let mockPending = false;
let mockUserId = 'account-a';
const mockMailboxQuery = jest.fn();
const mockLabelQuery = jest.fn();
/** What the suite reads from the sidebar MailboxShell hands Bloom's AppShell. */
interface SidebarItem {
  key: string;
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
}
interface SidebarProps {
  items: SidebarItem[];
  selected?: string;
  primaryAction?: { onPress: () => void };
  footer?: (state: { collapsed: boolean }) => ReactNode;
}
interface ShellState {
  sidebarCollapsed: boolean;
  moreExpanded: boolean;
  toggleMore: () => void;
  toggleSidebar: () => void;
  viewMode?: unknown;
}
let mockSidebar: SidebarProps | null = null;
let mockState: ShellState;
/** The sidebar's last props; fails the test if the shell was not rendered. */
function mockSidebarProps(): SidebarProps {
  if (!mockSidebar) throw new Error('the app shell was not rendered');
  return mockSidebar;
}
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
  View: ({ children }: Children) => <div>{children}</div>,
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPath,
}));
jest.mock('@oxy.so/bloom/content-panel', () => ({
  ContentPanel: ({ children, appearance = 'solid' }: Children & { appearance?: string }) => (
    <div data-panel-appearance={appearance}>{children}</div>
  ),
}));
jest.mock('@oxy.so/bloom/styles', () => ({ BREAKPOINTS: { md: 768, lg: 1024 } }));
jest.mock('@oxy.so/bloom/app-shell', () => ({
  APP_SHELL_DEFAULTS: { dashboardGutter: 12 },
  AppShell: ({
    sidebar,
    bottomBar,
    panelLayout,
  }: {
    sidebar: SidebarProps;
    bottomBar?: ReactNode;
    panelLayout: {
      activePanel: string;
      panels: { id: string; content: ReactNode; visible?: boolean; appearance?: string }[];
    };
  }) => {
    mockSidebar = sidebar;
    return (
      <div data-testid="workspace" data-active-panel={panelLayout.activePanel}>
        {sidebar.footer?.({ collapsed: false })}
        {panelLayout.panels.map((panel) => (
          <div key={panel.id} data-panel-appearance={panel.appearance}>
            {panel.visible !== false && (panel.id !== 'list' || mockDesktop) ? panel.content : null}
          </div>
        ))}
        {bottomBar}
      </div>
    );
  },
}));
jest.mock('@oxy.so/bloom/dialog', () => ({
  useDialogControl: () => ({ open: jest.fn(), close: jest.fn() }),
  Dialog: ({ children, actions }: Children & { actions?: DialogAction[] }) => (
    <div>
      {children}
      {actions?.map((action: DialogAction) => (
        <button type="button" key={action.label} onClick={action.onPress}>
          {action.label}
        </button>
      ))}
    </div>
  ),
}));
jest.mock('@oxy.so/bloom/button', () => ({
  Button: ({ children, onPress, disabled }: Pressable) => (
    <button type="button" disabled={disabled} onClick={onPress}>
      {children}
    </button>
  ),
}));
jest.mock('@oxy.so/bloom/text-field', () => ({
  TextFieldInput: ({
    label,
    value,
    onChangeText,
  }: {
    label?: string;
    value?: string;
    onChangeText: (text: string) => void;
  }) => (
    <input
      aria-label={label}
      value={value}
      onChange={(event) => onChangeText(event.target.value)}
    />
  ),
}));
jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({
    user: mockAuthenticated ? { id: mockUserId } : null,
    isAuthenticated: mockAuthenticated,
    canUsePrivateApi: mockAuthenticated && mockTokenReady,
    isAccountCacheReady: mockCacheReady,
    openAccountDialog: jest.fn(),
  }),
  // SDK readiness contract; the gate's own implementation is tested in services.
  RequireOxyAuth: ({
    children,
    loadingFallback,
    signedOutFallback,
  }: Children & {
    loadingFallback: ReactNode;
    signedOutFallback?: ReactNode;
  }) => {
    if (mockAuthenticated && mockTokenReady && mockCacheReady) return children;
    if (mockPending || (mockAuthenticated && mockTokenReady)) return loadingFallback;
    return signedOutFallback ?? <button type="button">Sign in</button>;
  },
  ProfileButton: () => <button type="button">{mockAuthenticated ? 'Account' : 'Sign in'}</button>,
  OxySignInButton: () => <button type="button">Sign in</button>,
}));
jest.mock('@/constants/theme', () => ({
  useColors: () => ({ primary: 'purple' }),
}));
jest.mock('@/assets/logo', () => ({ LogoIcon: () => null }));
jest.mock('@/hooks/useIsDesktopLayout', () => ({
  useIsDesktopLayout: () => mockDesktop,
}));
// Keys echo back — except the mailbox names, so a test can tell a translated
// name from the raw `specialUse` fallback.
jest.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => (key.startsWith('drawer.mailboxes.') ? `T(${key})` : key),
  }),
}));
jest.mock('@/hooks/queries/useMailboxes', () => ({
  useMailboxes: (options: unknown) => {
    mockMailboxQuery(options);
    return { data: mockMailboxes };
  },
}));
jest.mock('@/hooks/queries/useLabels', () => ({
  useLabels: (options: unknown) => {
    mockLabelQuery(options);
    return { data: [{ _id: 'label-id', name: 'Receipts', color: '#123456' }] };
  },
}));
jest.mock('@/hooks/mutations/useMailboxMutations', () => ({
  useCreateMailbox: () => ({ mutate: mockCreate }),
  useDeleteMailbox: () => ({ mutate: mockDelete }),
}));
jest.mock('@/hooks/useEmail', () => ({
  useEmailStore: Object.assign((selector: (state: ShellState) => unknown) => selector(mockState), {
    getState: () => mockState,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthenticated = true;
  mockTokenReady = true;
  mockCacheReady = true;
  mockPending = false;
  mockUserId = 'account-a';
  mockDesktop = true;
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
    act(() => defined(mockSidebarProps().items.find((item) => item.key === key)).onPress());
    expect(mockPush).toHaveBeenLastCalledWith(expected);
  }
  act(() => defined(mockSidebarProps().primaryAction, 'the compose action').onPress());
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
  const custom = defined(mockSidebarProps().items.find((item) => item.key === 'custom-id'));
  act(() => defined(custom.onLongPress, 'a long-press handler')());
  fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));
  expect(mockDelete).toHaveBeenCalledWith({ mailboxId: 'custom-id' }, expect.any(Object));
  fireEvent.click(screen.getByRole('button', { name: 'common.delete · Invoices' }));
  fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));
  expect(mockDelete).toHaveBeenCalledTimes(2);
});

it('selects label destinations and leaves auth-only actions absent when signed out', () => {
  mockPath = '/label/receipts';
  const view = render(<MailboxShell>{null}</MailboxShell>);
  expect(mockSidebarProps().selected).toBe('label:receipts');
  mockAuthenticated = false;
  view.rerender(<MailboxShell>{null}</MailboxShell>);
  expect(mockSidebarProps().items.map((item) => item.key)).toEqual([
    'inbox',
    'sent',
    'drafts',
    'starred',
  ]);
  expect(mockSidebarProps().primaryAction).toBeUndefined();
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'auth.gate.title' })).toBeTruthy();
  expect(screen.getByText('auth.gate.subtitle')).toBeTruthy();
});

it('keeps the source mailbox selected while reading a conversation', () => {
  mockPath = '/conversation/message-id';
  mockState.viewMode = { type: 'mailbox', mailbox: mockMailboxes[1] };
  render(<MailboxShell>{null}</MailboxShell>);
  expect(mockSidebarProps().selected).toBe('sent-id');
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
  mockDesktop = false;
  view.rerender(
    <MailboxShell>
      <RetainedRoute />
    </MailboxShell>,
  );
  expect(screen.getByLabelText('Retained draft')).toBe(draft);
  expect((screen.getByLabelText('Retained draft') as HTMLInputElement).value).toBe('Keep my draft');
  mockDesktop = true;
  view.rerender(
    <MailboxShell>
      <RetainedRoute />
    </MailboxShell>,
  );
  expect(screen.getByLabelText('Retained draft')).toBe(draft);

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
    const junk = defined(mockSidebarProps().items.find((item) => item.key === 'junk-id'));
    expect(junk.label).toBe('T(drawer.mailboxes.Spam)');
  } finally {
    mockMailboxes.pop();
  }
});

it('preserves the workspace through identity, token and cache restoration while private panels wait', () => {
  mockAuthenticated = false;
  mockTokenReady = false;
  mockCacheReady = false;
  mockPending = true;
  const content = (
    <MailboxShell>
      <PrivateInboxContent>
        <span>Private message</span>
      </PrivateInboxContent>
    </MailboxShell>
  );
  const view = render(content);
  const workspace = screen.getByTestId('workspace');
  const navigation = screen.getByRole('navigation', { name: 'Mail navigation' });
  const expectPending = () => {
    expect(screen.getByTestId('workspace')).toBe(workspace);
    expect(screen.getByRole('navigation', { name: 'Mail navigation' })).toBe(navigation);
    expect(screen.queryByText('Private message')).toBeNull();
    expect(screen.queryByText('Mailbox list')).toBeNull();
    expect(screen.queryByText('Sign in')).toBeNull();
    expect(mockMailboxQuery).toHaveBeenLastCalledWith({ enabled: false });
    expect(mockLabelQuery).toHaveBeenLastCalledWith({ enabled: false });
    expect(mockSidebarProps().items.some((item) => item.label === 'Invoices')).toBe(false);
    expect(mockSidebarProps().items.some((item) => item.label === 'Receipts')).toBe(false);
  };
  expectPending();
  mockAuthenticated = true;
  view.rerender(
    <MailboxShell>
      <PrivateInboxContent>
        <span>Private message</span>
      </PrivateInboxContent>
    </MailboxShell>,
  );
  expectPending();
  mockTokenReady = true;
  mockPending = false;
  view.rerender(
    <MailboxShell>
      <PrivateInboxContent>
        <span>Private message</span>
      </PrivateInboxContent>
    </MailboxShell>,
  );
  expectPending();
  mockCacheReady = true;
  view.rerender(
    <MailboxShell>
      <PrivateInboxContent>
        <span>Private message</span>
      </PrivateInboxContent>
    </MailboxShell>,
  );
  expect(screen.getByTestId('workspace')).toBe(workspace);
  expect(screen.getByText('Private message')).toBeTruthy();
  expect(screen.getByText('Mailbox list')).toBeTruthy();
  expect(mockMailboxQuery).toHaveBeenLastCalledWith({ enabled: true });
  expect(mockLabelQuery).toHaveBeenLastCalledWith({ enabled: true });

  // The previous account's folder dialog and draft cannot survive a switch.
  fireEvent.change(screen.getByLabelText('ui.drawer.folderName'), {
    target: { value: 'Private A folder' },
  });
  mockCacheReady = false;
  mockUserId = 'account-b';
  view.rerender(
    <MailboxShell>
      <PrivateInboxContent>
        <span>Private message</span>
      </PrivateInboxContent>
    </MailboxShell>,
  );
  expectPending();
  expect(screen.queryByLabelText('ui.drawer.folderName')).toBeNull();
  mockCacheReady = true;
  view.rerender(
    <MailboxShell>
      <PrivateInboxContent>
        <span>Private message</span>
      </PrivateInboxContent>
    </MailboxShell>,
  );
  expect(screen.getByTestId('workspace')).toBe(workspace);
  expect((screen.getByLabelText('ui.drawer.folderName') as HTMLInputElement).value).toBe('');

  mockAuthenticated = false;
  view.rerender(
    <MailboxShell>
      <PrivateInboxContent>
        <span>Private message</span>
      </PrivateInboxContent>
    </MailboxShell>,
  );
  expect(screen.getByTestId('workspace')).toBe(workspace);
  expect(screen.queryByText('Private message')).toBeNull();
  expect(screen.getAllByText('Sign in').length).toBeGreaterThan(0);
});

it('resets private route state on a direct ready-account switch while retaining its shell', () => {
  function PrivateRoute() {
    const [draft, setDraft] = useState('');
    return (
      <input
        aria-label="Account draft"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
    );
  }
  const view = render(
    <MailboxShell>
      <PrivateInboxContent>
        <PrivateRoute />
      </PrivateInboxContent>
    </MailboxShell>,
  );
  const workspace = screen.getByTestId('workspace');
  const oldDraft = screen.getByLabelText('Account draft');
  fireEvent.change(oldDraft, { target: { value: 'Private account A text' } });
  mockUserId = 'account-b';
  view.rerender(
    <MailboxShell>
      <PrivateInboxContent>
        <PrivateRoute />
      </PrivateInboxContent>
    </MailboxShell>,
  );
  expect(screen.getByTestId('workspace')).toBe(workspace);
  expect(screen.getByLabelText('Account draft')).not.toBe(oldDraft);
  expect((screen.getByLabelText('Account draft') as HTMLInputElement).value).toBe('');
});

it.each([
  ['/', 'list'],
  ['/sent', 'list'],
  ['/label/important', 'list'],
  ['/search', 'list'],
  ['/conversation/mail-a', 'detail'],
  ['/search/conversation/mail-a', 'detail'],
  ['/compose', 'detail'],
  ['/subscriptions', 'detail'],
])('selects the compositor panel for %s without mounting a second mailbox list', (path, panel) => {
  mockPath = path;
  render(
    <MailboxShell>
      <span>Routed detail</span>
    </MailboxShell>,
  );
  expect(screen.getByTestId('workspace').getAttribute('data-active-panel')).toBe(panel);
  expect(screen.queryAllByRole('heading', { name: 'Mailbox chrome' }).length).toBeLessThanOrEqual(
    1,
  );
});

it.each([
  ['/', '/', 'list'],
  ['/', '/sent', 'list'],
  ['/', '/label/important', 'list'],
  ['/', '/compose', 'detail'],
  ['/', '/conversation/mail-a', 'detail'],
  ['/', '/search/conversation/mail-a', 'detail'],
  ['/compose', '/compose', 'detail'],
  ['/search', '/search', 'list'],
  ['/sent', '/sent', 'list'],
])(
  'hydrates static %s HTML at %s before mounting its route children',
  async (serverPath, path, panel) => {
    mockAuthenticated = false;
    mockTokenReady = false;
    mockCacheReady = false;
    mockPending = true;
    const routeRendered = jest.fn();
    function RoutedContent() {
      routeRendered(mockPath);
      return mockPath === '/' ? <article>Index route</article> : <section>{mockPath}</section>;
    }
    mockPath = serverPath;
    const container = document.createElement('div');
    const shell = (
      <MailboxShell>
        <RoutedContent />
      </MailboxShell>
    );
    container.innerHTML = renderToString(shell);
    document.body.appendChild(container);
    const original = container.querySelector('[data-testid="workspace"]');
    const header = container.querySelector('h1');
    const navigation = container.querySelector('nav');
    expect(original?.getAttribute('data-active-panel')).toBe('list');
    expect(container.textContent).toContain('empty.selectConversation');
    expect(routeRendered).not.toHaveBeenCalled();
    mockPath = path;
    const onRecoverableError = jest.fn();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    let root: Root | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, shell, { onRecoverableError });
      });
      expect(container.querySelector('[data-testid="workspace"]')).toBe(original);
      if (!path.startsWith('/search')) expect(container.querySelector('h1')).toBe(header);
      expect(container.querySelector('nav')).toBe(navigation);
      expect(navigation?.getAttribute('data-selected')).toBe(
        path.startsWith('/search') ? 'search' : 'inbox',
      );
      expect(original?.getAttribute('data-active-panel')).toBe(panel);
      expect(container.querySelector(path === '/' ? 'article' : 'section')?.textContent).toBe(
        path === '/' ? 'Index route' : path,
      );
      expect(routeRendered).toHaveBeenCalledWith(path);
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      await act(async () => root?.unmount());
      container.remove();
      consoleError.mockRestore();
    }
  },
);
