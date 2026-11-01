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
import { SPECIAL_USE } from '@/constants/mailbox';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { OxyServices } from '@oxy.so/core';
import { QueryClientProvider } from '@tanstack/react-query';
import { createInboxQueryClient, INBOX_ACCOUNT_QUERIES } from '@/hooks/queries/queryClient';
import { useEmailStore } from '@/hooks/useEmail';
import type { Children, DialogAction, Pressable } from '../fixtures/mockProps';

jest.mock('@/components/settings/InboxSettings', () => ({
  useInboxSettings: () => jest.fn(),
}));

let mockOxy: OxyServices;
let mockRuntime: ReturnType<typeof import('@oxy.so/services/runtime').useOxyRuntime>;
const mockToast = { success: jest.fn(), error: jest.fn() };
jest.mock('@oxy.so/services/runtime', () => ({ useOxyRuntime: () => mockRuntime }));
jest.mock('@oxy.so/bloom/toast', () => ({ toast: mockToast }));
const mockPush = jest.fn();
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
  useRouter: () => ({ push: mockPush, replace: mockPush }),
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
let mockDeferDialogAction = false;
let mockPendingDialogAction: (() => void) | undefined;
jest.mock('@oxy.so/bloom/dialog', () => ({
  useDialogControl: () => ({ open: jest.fn(), close: jest.fn() }),
  Dialog: ({
    children,
    actions,
    description,
  }: Children & { actions?: (DialogAction & { disabled?: boolean })[]; description?: string }) => (
    <div>
      {description && <p>{description}</p>}
      {children}
      {actions?.map((action) => (
        <button
          type="button"
          key={action.label}
          disabled={action.disabled}
          onClick={() => {
            if (mockDeferDialogAction) mockPendingDialogAction = action.onPress;
            else action.onPress?.();
          }}
        >
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
    oxyServices: mockOxy,
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
import { MailboxShell } from '@/components/MailboxShell';

function token(subject: string, session: string) {
  return `e30.${Buffer.from(JSON.stringify({ userId: subject, sessionId: session, exp: 2000000000 })).toString('base64url')}.fixture`;
}
function response(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: () => 'application/json' },
    json: async () => body,
    text: async () => JSON.stringify(body),
    clone() {
      return this;
    },
  };
}
let previousFetch: typeof fetch;
beforeEach(() => {
  jest.clearAllMocks();
  mockDeferDialogAction = false;
  mockPendingDialogAction = undefined;
  previousFetch = globalThis.fetch;
  mockUserId = 'alice';
  mockAuthenticated = true;
  mockTokenReady = true;
  mockCacheReady = true;
  mockPending = false;
  mockDesktop = true;
  mockPath = '/';
  mockOxy = new OxyServices({
    baseURL: 'https://api.test',
    enableRetry: false,
    enableCache: false,
  });
  mockOxy.session.setAccessToken(token('alice', 'a-session'));
  const { dirname, join } = require('node:path');
  const dir = dirname(require.resolve('@oxy.so/services/package.json'));
  const { createOxyRuntime } = require(join(dir, 'lib/commonjs/ui/runtime/createOxyRuntime.js'));
  mockRuntime = createOxyRuntime({
    oxyServices: mockOxy,
    sessionClient: { getState: () => null, getDirectory: () => null, subscribe: () => () => {} },
    sessionClientHost: { setCurrentAccountId: () => {} },
    identity: null,
    onDeviceEmpty: async () => {},
    logger: () => {},
  });
  mockRuntime.batch(() => {
    mockRuntime.setAccount({ id: 'alice' });
    mockRuntime.setActiveSessionId('a-session');
  });
});
afterEach(() => {
  useEmailStore.getState().resetAccountScopedState();
  mockOxy.dispose();
  globalThis.fetch = previousFetch;
});
function setupPersistence(client: ReturnType<typeof createInboxQueryClient>) {
  const { dirname, join } = require('node:path');
  const dir = dirname(require.resolve('@oxy.so/services/package.json'));
  const { createAccountQueryPersistence } = require(
    join(dir, 'lib/commonjs/ui/hooks/accountQueryPersistence.js'),
  );
  const values = new Map<string, string>();
  const storage = {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: async (key: string) => {
      values.delete(key);
    },
  };
  const p = createAccountQueryPersistence(client, INBOX_ACCOUNT_QUERIES);
  p.setStorage(storage);
  p.attach();
  return p;
}
it.each(['create', 'delete'] as const)(
  'does not show a stale %s failure after changing accounts',
  async (action) => {
    let finish!: (value: ReturnType<typeof response>) => void, begin!: () => void;
    const reply = new Promise<ReturnType<typeof response>>((resolve) => {
      finish = resolve;
    });
    const started = new Promise<void>((resolve) => {
      begin = resolve;
    });
    const sent: string[] = [];
    globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      sent.push(new Headers(init?.headers).get('authorization') ?? '');
      begin();
      return reply;
    }) as never;
    const client = createInboxQueryClient();
    const persistence = setupPersistence(client);
    persistence.activate('alice');
    await persistence.whenReady();
    useEmailStore.getState()._initApi(mockOxy.http);
    const view = render(
      <QueryClientProvider client={client}>
        <MailboxShell>{null}</MailboxShell>
      </QueryClientProvider>,
    );
    if (action === 'create') {
      fireEvent.change(screen.getByLabelText('ui.drawer.folderName'), {
        target: { value: 'Synthetic' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'ui.drawer.createFolderButton' }));
    } else {
      fireEvent.click(screen.getByRole('button', { name: 'common.delete · Invoices' }));
      fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));
    }
    await started;
    const mutation = client.getMutationCache().getAll().at(-1);
    if (!mutation) throw new Error('Expected mutation');
    act(() => {
      mockUserId = 'bob';
      mockOxy.session.setAccessToken(token('bob', 'b-session'));
      mockRuntime.batch(() => {
        mockRuntime.setAccount({ id: 'bob' });
        mockRuntime.setActiveSessionId('b-session');
      });
      useEmailStore.getState().resetAccountScopedState();
      useEmailStore.getState()._initApi(mockOxy.http);
      persistence.activate('bob');
      view.rerender(
        <QueryClientProvider client={client}>
          <MailboxShell>{null}</MailboxShell>
        </QueryClientProvider>,
      );
    });
    await persistence.whenReady();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    await act(async () => {
      finish(response({}));
    });
    await waitFor(() => expect(mutation.state.status).not.toBe('pending'));
    expect(mockToast.error).not.toHaveBeenCalled();
    expect(mockToast.success).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
    expect(sent).toEqual([`Bearer ${token('alice', 'a-session')}`]);
    view.unmount();
    persistence.detach();
    client.clear();
  },
);

it.each([false, true])(
  'rejects a retained delete confirmation after A to B (returnToA=%s)',
  async (returnToA) => {
    const headers: string[] = [];
    globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      headers.push(new Headers(init?.headers).get('authorization') ?? '');
      return response({});
    }) as never;
    const client = createInboxQueryClient();
    const persistence = setupPersistence(client);
    persistence.activate('alice');
    await persistence.whenReady();
    useEmailStore.getState()._initApi(mockOxy.http);
    const view = render(
      <QueryClientProvider client={client}>
        <MailboxShell>{null}</MailboxShell>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'common.delete · Invoices' }));
    mockDeferDialogAction = true;
    fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));
    const retained = mockPendingDialogAction;
    if (!retained) throw new Error('Expected retained dialog callback');
    act(() => {
      mockUserId = 'bob';
      mockOxy.session.setAccessToken(token('bob', 'b-session'));
      mockRuntime.batch(() => {
        mockRuntime.setAccount({ id: 'bob' });
        mockRuntime.setActiveSessionId('b-session');
      });
      useEmailStore.getState().resetAccountScopedState();
      useEmailStore.getState()._initApi(mockOxy.http);
      persistence.activate('bob');
      view.rerender(
        <QueryClientProvider client={client}>
          <MailboxShell>{null}</MailboxShell>
        </QueryClientProvider>,
      );
    });
    await persistence.whenReady();
    if (returnToA) {
      act(() => {
        mockUserId = 'alice';
        mockOxy.session.setAccessToken(token('alice', 'a-session'));
        mockRuntime.batch(() => {
          mockRuntime.setAccount({ id: 'alice' });
          mockRuntime.setActiveSessionId('a-session');
        });
        useEmailStore.getState().resetAccountScopedState();
        useEmailStore.getState()._initApi(mockOxy.http);
        persistence.activate('alice');
        view.rerender(
          <QueryClientProvider client={client}>
            <MailboxShell>{null}</MailboxShell>
          </QueryClientProvider>,
        );
      });
      await persistence.whenReady();
    }
    act(() => retained());
    await waitFor(() =>
      expect(client.getMutationCache().getAll().at(-1)?.state.status).not.toBe('pending'),
    );
    expect(headers).toEqual([]);
    expect(mockToast.error).not.toHaveBeenCalled();
    view.unmount();
    persistence.detach();
    client.clear();
  },
);

it('disables a confirmation opened in an earlier session until the user chooses the folder again', async () => {
  globalThis.fetch = jest.fn(async () => response({})) as never;
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  const view = render(
    <QueryClientProvider client={client}>
      <MailboxShell>{null}</MailboxShell>
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'common.delete · Invoices' }));
  expect(
    (screen.getByRole('button', { name: 'common.delete' }) as HTMLButtonElement).disabled,
  ).toBe(false);
  act(() => {
    mockOxy.session.setAccessToken(token('alice', 'a-new'));
    mockRuntime.setActiveSessionId('a-new');
  });
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: 'common.delete' }) as HTMLButtonElement).disabled,
    ).toBe(true),
  );
  expect(screen.getByText('ui.mutations.mailboxSelectionExpired')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));
  expect(globalThis.fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'common.delete · Invoices' }));
  fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));
  await waitFor(() =>
    expect(mockToast.success).toHaveBeenCalledWith('ui.mutations.mailboxDeleted'),
  );
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  view.unmount();
  client.clear();
});

it('deletes the selected folder and navigates to Inbox for the current owner', async () => {
  globalThis.fetch = jest.fn(async () => response({})) as never;
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  useEmailStore.setState({
    viewMode: { type: 'mailbox', mailbox: mockMailboxes[2] } as never,
    currentMailbox: mockMailboxes[2] as never,
    selectedMessageId: 'synthetic',
  });
  const view = render(
    <QueryClientProvider client={client}>
      <MailboxShell>{null}</MailboxShell>
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'common.delete · Invoices' }));
  fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
  expect(mockToast.success).toHaveBeenCalledWith('ui.mutations.mailboxDeleted');
  expect(useEmailStore.getState().viewMode).toBeNull();
  expect(useEmailStore.getState().selectedMessageId).toBeNull();
  view.unmount();
  client.clear();
});

it('reports an unavailable current account when creating a folder without sending', async () => {
  globalThis.fetch = jest.fn() as never;
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <MailboxShell>{null}</MailboxShell>
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText('ui.drawer.folderName'), {
    target: { value: 'Synthetic' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'ui.drawer.createFolderButton' }));
  await waitFor(() =>
    expect(mockToast.error).toHaveBeenCalledWith('ui.mutations.mailboxSessionUnavailable'),
  );
  expect(globalThis.fetch).not.toHaveBeenCalled();
  expect((screen.getByLabelText('ui.drawer.folderName') as HTMLInputElement).value).toBe(
    'Synthetic',
  );
  view.unmount();
  client.clear();
});

it('creates a folder and clears its form after a current-owner confirmation', async () => {
  const at = '2026-01-01T00:00:00.000Z';
  globalThis.fetch = jest.fn(async () =>
    response({
      data: {
        _id: 'synthetic-folder',
        id: 'synthetic-folder',
        userId: 'alice',
        name: 'Synthetic',
        path: 'Synthetic',
        specialUse: null,
        retentionDays: null,
        totalMessages: 0,
        unseenMessages: 0,
        size: 0,
        createdAt: at,
        updatedAt: at,
      },
    }),
  ) as never;
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  const view = render(
    <QueryClientProvider client={client}>
      <MailboxShell>{null}</MailboxShell>
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText('ui.drawer.folderName'), {
    target: { value: 'Synthetic' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'ui.drawer.createFolderButton' }));
  await waitFor(() =>
    expect(mockToast.success).toHaveBeenCalledWith('ui.mutations.mailboxCreated'),
  );
  await waitFor(() =>
    expect((screen.getByLabelText('ui.drawer.folderName') as HTMLInputElement).value).toBe(''),
  );
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  view.unmount();
  client.clear();
});
