/** Exercise the real list while identity, token, cache and mail resolve separately. */
import type { Message } from '@/services/emailApi';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { OxyServices } from '@oxy.so/core';
import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { createInboxQueryClient, INBOX_ACCOUNT_QUERIES } from '@/hooks/queries/queryClient';
import { useEmailStore } from '@/hooks/useEmail';

type Children = { children?: ReactNode };
let mockAuth = {
  user: null as { id: string } | null,
  isAuthenticated: false,
  canUsePrivateApi: false,
  isAccountCacheReady: false,
  isPrivateApiPending: true,
};
let mockMessages: Message[] = [];
const mockLoading = false;
let mockBrief: { summary: string; items: { messageId: string }[] } | undefined;
const mockAiBrief = true;
const mockNoop = jest.fn();
const mockRefetch = jest.fn(async () => undefined);
const mockPush = jest.fn();
const mockMutation = { mutate: mockNoop, isPending: false };
const mockTranslate = (key: string) => key;
let mockOxy: OxyServices;
let mockRuntime: ReturnType<typeof import('@oxy.so/services/runtime').useOxyRuntime>;
const mockReminder = {
  _id: 'synthetic-reminder',
  text: 'Synthetic',
  remindAt: '2025-01-01T00:00:00.000Z',
  completed: false,
  relatedMessageId: null,
};
const mockToast = { error: jest.fn() };
jest.mock('@oxy.so/services/runtime', () => ({ useOxyRuntime: () => mockRuntime }));
const mockActions = { isArchived: () => false };

jest.mock('react-native', () => ({
  View: ({ children }: Children) => <div>{children}</div>,
  RefreshControl: () => null,
  StyleSheet: { create: (styles: unknown) => styles },
}));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { createAnimatedComponent: (component: unknown) => component },
}));
jest.mock('@shopify/flash-list', () => ({
  FlashList: ({
    data,
    renderItem,
    ListHeaderComponent,
    ListEmptyComponent,
  }: {
    data: { key?: string; data?: Message }[];
    renderItem: (args: { item: unknown }) => ReactNode;
    ListHeaderComponent?: ReactNode;
    ListEmptyComponent?: (() => ReactNode) | null;
  }) => (
    <section data-testid="mail-rows">
      {ListHeaderComponent}
      {data.length
        ? data.map((item, index) => (
            <div key={item.key ?? item.data?._id ?? index}>{renderItem({ item })}</div>
          ))
        : ListEmptyComponent?.()}
    </section>
  ),
}));
jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({ ...mockAuth, oxyServices: mockOxy }),
  OxySignInButton: () => <button type="button">Sign in</button>,
  RequireOxyAuth: ({
    children,
    loadingFallback = null,
    signedOutFallback = null,
  }: Children & {
    loadingFallback?: ReactNode;
    signedOutFallback?: ReactNode;
  }) =>
    mockAuth.canUsePrivateApi && mockAuth.isAccountCacheReady
      ? children
      : mockAuth.isPrivateApiPending || mockAuth.isAuthenticated
        ? loadingFallback
        : signedOutFallback,
}));
jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  useRouter: () => ({ push: mockPush, replace: mockPush }),
}));
jest.mock('@oxy.so/bloom/app-shell', () => ({
  useAppShell: () => ({ drawerAvailable: true, openDrawer: mockNoop }),
}));
jest.mock('@oxy.so/bloom/screen', () => ({
  Screen: ({ header, children }: Children & { header?: ReactNode }) => (
    <main>
      {header}
      {children}
    </main>
  ),
}));
jest.mock('@oxy.so/bloom/page-header', () => ({
  PageHeader: ({
    title,
    leading,
    actions,
  }: {
    title: string;
    leading?: ReactNode;
    actions?: ReactNode;
  }) => (
    <header>
      {leading}
      <h1>{title}</h1>
      {actions}
    </header>
  ),
}));
jest.mock('@oxy.so/bloom/typography', () => ({
  Text: ({ children }: Children) => <span>{children}</span>,
}));
jest.mock('@oxy.so/bloom/button-group', () => ({
  ButtonGroup: ({ children }: Children) => <div>{children}</div>,
  ButtonGroupItem: ({
    children,
    accessibilityLabel,
    onPress,
  }: Children & {
    accessibilityLabel?: string;
    onPress?: () => void;
  }) => (
    <button type="button" aria-label={accessibilityLabel} onClick={onPress}>
      {children}
    </button>
  ),
}));
jest.mock('@oxy.so/bloom/empty-state', () => ({ EmptyState: () => <p>Empty mailbox</p> }));
jest.mock('@oxy.so/bloom/toast', () => ({
  toast: mockToast,
}));
jest.mock('@alia.onl/sdk/avatar', () => ({ AliaAvatarIcon: () => null }));
jest.mock('@/constants/theme', () => ({ useColors: () => ({}) }));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: mockTranslate, locale: 'en' }) }));
jest.mock('@/contexts/inbox-prefs-context', () => ({
  DEFAULT_INBOX_PREFS: { aiBrief: true },
  useInboxPrefs: () => ({ prefs: { aiBrief: mockAiBrief, aiCategorization: false } }),
}));
jest.mock('@/hooks/useInboxDisplayPrefs', () => ({
  useInboxDisplayPrefs: () => ({ density: 'comfortable', showPreviews: true }),
}));
jest.mock('@/hooks/useCurrentList', () => ({
  useCurrentList: () => ({
    query: {
      isLoading: mockLoading,
      isError: false,
      refetch: mockRefetch,
      fetchNextPage: mockNoop,
    },
    options: { mailboxId: 'inbox' },
    listReady: true,
    messages: mockMessages,
    rows: mockMessages,
    unreadable: [],
    conversationOf: (id: string) => mockMessages.filter((message) => message._id === id),
  }),
}));
jest.mock('@/hooks/queries/useMailboxes', () => ({
  useMailboxes: () => ({ data: [], refetch: mockRefetch, isError: false }),
}));
jest.mock('@/hooks/queries/useBundles', () => ({ useBundles: () => ({ data: [] }) }));
jest.mock('@/hooks/queries/useReminders', () => ({
  useReminders: () => ({ data: { data: [mockReminder] } }),
}));
jest.mock('@/hooks/queries/useDailyBrief', () => ({
  useDailyBrief: () => ({ brief: mockBrief, isLoading: !mockBrief, error: null }),
}));
jest.mock('@/hooks/queries/useSentimentAnalysis', () => ({
  useBatchSentimentAnalysis: () => new Map(),
}));
jest.mock('@/hooks/mutations/useMessageMutations', () => ({
  useTogglePin: () => mockMutation,
  useBulkUpdateFlags: () => mockMutation,
}));
jest.mock('@/hooks/useMessageActions', () => ({ useMessageActions: () => mockActions }));
jest.mock('@/hooks/useLeaveRemovedRows', () => ({ useLeaveRemovedRows: () => mockNoop }));
jest.mock('@/hooks/useMailboxScrollRestoration', () => ({
  useMailboxScrollRestoration: () => mockNoop,
}));
jest.mock('@/components/MessageRow', () => ({
  MessageRow: ({ message }: { message: Message }) => (
    <article data-message={message._id}>{message.subject}</article>
  ),
}));
jest.mock('@/components/DailyBrief', () => ({
  DailyBrief: () =>
    mockBrief ? (
      <aside data-testid="brief-card">
        {mockBrief.summary}
        {mockBrief.items.map((item) => (
          <article key={item.messageId} data-message={item.messageId}>
            {item.messageId}
          </article>
        ))}
      </aside>
    ) : null,
}));
jest.mock('@/components/SwipeableRow', () => ({
  SwipeableRow: ({ children }: Children) => children,
}));
jest.mock('@/components/BundleRow', () => ({ BundleRow: () => null }));
jest.mock('@/components/EmptyStateSticker', () => ({ EmptyStateSticker: () => null }));
jest.mock('@/components/UndeliveredBanner', () => ({ UndeliveredBanner: () => null }));
jest.mock('@oxy.so/bloom/checkbox', () => ({
  Checkbox: ({ onCheckedChange }: { onCheckedChange: (value: boolean) => void }) => (
    <button type="button" aria-label="toggle reminder" onClick={() => onCheckedChange(true)} />
  ),
}));
jest.mock('@oxy.so/bloom/item', () => ({
  Item: ({
    title,
    leading,
    trailing,
  }: {
    title: ReactNode;
    leading: ReactNode;
    trailing: ReactNode;
  }) => (
    <div>
      {leading}
      {title}
      {trailing}
    </div>
  ),
}));
let mockDelayDelete = false;
let mockRetainedDelete: (() => void) | undefined;
jest.mock('@oxy.so/bloom/button', () => ({
  Button: ({ children, onPress }: { children: ReactNode; onPress: () => void }) => (
    <button type="button" onClick={onPress}>
      {children}
    </button>
  ),
  IconButton: ({
    accessibilityLabel,
    onPress,
  }: {
    accessibilityLabel: string;
    onPress: () => void;
  }) => (
    <button
      type="button"
      aria-label={accessibilityLabel}
      onClick={() => {
        if (mockDelayDelete) mockRetainedDelete = onPress;
        else onPress();
      }}
    />
  ),
}));
jest.mock('@/components/UnreadableMessageRow', () => ({ UnreadableMessageRow: () => null }));
jest.mock('@/components/SelectionToolbar', () => ({
  SelectionToolbar: () => <p>Private selection</p>,
}));
jest.mock('@/components/SnoozeSheet', () => ({ SnoozeSheet: () => null }));
jest.mock('@/components/CreateReminderSheet', () => ({
  CreateReminderSheet: ({
    visible,
    onClose,
    onUpdate,
    unavailableMessage,
  }: {
    visible: boolean;
    onClose: () => void;
    onUpdate: (text: string, at: Date) => Promise<void>;
    unavailableMessage?: string;
  }) =>
    visible ? (
      <section aria-label="synthetic editor">
        <p>{unavailableMessage}</p>
        <button type="button" onClick={onClose}>
          close editor
        </button>
        <button
          type="button"
          disabled={!!unavailableMessage}
          onClick={() => {
            void onUpdate('Changed', new Date('2030-01-01T00:00:00.000Z')).catch(() => {});
          }}
        >
          save editor
        </button>
      </section>
    ) : null,
}));
jest.mock('@/components/InboxAlia', () => ({
  __esModule: true,
  default: () => <p>Private Alia</p>,
}));

import { InboxList } from '@/components/InboxList';
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
  mockDelayDelete = false;
  mockRetainedDelete = undefined;
  previousFetch = globalThis.fetch;
  mockAuth = {
    user: { id: 'alice' },
    isAuthenticated: true,
    canUsePrivateApi: true,
    isAccountCacheReady: true,
    isPrivateApiPending: false,
  };
  mockMessages = [];
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
  onlineManager.setOnline(true);
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
  const m = new Map<string, string>();
  const p = createAccountQueryPersistence(client, INBOX_ACCOUNT_QUERIES);
  p.setStorage({
    getItem: async (k: string) => m.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      m.set(k, v);
    },
    removeItem: async (k: string) => {
      m.delete(k);
    },
  });
  p.attach();
  return p;
}
it('does not notify or invalidate B when A reminder deletion finishes after the switch', async () => {
  let begin!: () => void, finish!: (value: ReturnType<typeof response>) => void;
  const started = new Promise<void>((r) => {
    begin = r;
  });
  const reply = new Promise<ReturnType<typeof response>>((r) => {
    finish = r;
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
      <InboxList />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));
  await started;
  const mutation = client.getMutationCache().getAll().at(-1);
  if (!mutation) throw new Error('Expected mutation');
  act(() => {
    mockAuth = { ...mockAuth, user: { id: 'bob' } };
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
        <InboxList />
      </QueryClientProvider>,
    );
  });
  await persistence.whenReady();
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  await act(async () => finish(response({})));
  await waitFor(() => expect(mutation.state.status).not.toBe('pending'));
  expect(mockToast.error).not.toHaveBeenCalled();
  expect(invalidate).not.toHaveBeenCalled();
  expect(sent).toEqual([`Bearer ${token('alice', 'a-session')}`]);
  view.unmount();
  persistence.detach();
  client.clear();
});
it.each([false, true])(
  'rejects a retained A row action after A to B (returnToA=%s)',
  async (returnToA) => {
    const sent: string[] = [];
    globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      sent.push(new Headers(init?.headers).get('authorization') ?? '');
      return response({});
    }) as never;
    const client = createInboxQueryClient();
    const persistence = setupPersistence(client);
    persistence.activate('alice');
    await persistence.whenReady();
    useEmailStore.getState()._initApi(mockOxy.http);
    const view = render(
      <QueryClientProvider client={client}>
        <InboxList />
      </QueryClientProvider>,
    );
    mockDelayDelete = true;
    fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));
    const retained = mockRetainedDelete;
    if (!retained) throw new Error('Expected retained action');
    act(() => {
      mockAuth = { ...mockAuth, user: { id: 'bob' } };
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
          <InboxList />
        </QueryClientProvider>,
      );
    });
    await persistence.whenReady();
    if (returnToA) {
      act(() => {
        mockAuth = { ...mockAuth, user: { id: 'alice' } };
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
            <InboxList />
          </QueryClientProvider>,
        );
      });
      await persistence.whenReady();
    }
    act(() => retained());
    await waitFor(() =>
      expect(client.getMutationCache().getAll().at(-1)?.state.status).not.toBe('pending'),
    );
    expect(sent).toEqual([]);
    expect(mockToast.error).not.toHaveBeenCalled();
    view.unmount();
    persistence.detach();
    client.clear();
  },
);

it('deletes a reminder for the current owner and invalidates its query', async () => {
  globalThis.fetch = jest.fn(async () => response({})) as never;
  const client = createInboxQueryClient();
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  useEmailStore.getState()._initApi(mockOxy.http);
  const view = render(
    <QueryClientProvider client={client}>
      <InboxList />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));
  await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['reminders'] }));
  expect(mockToast.error).not.toHaveBeenCalled();
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  view.unmount();
  client.clear();
});

it('reports the current offline failure once and does not replay on reconnection', async () => {
  onlineManager.setOnline(false);
  globalThis.fetch = jest.fn(async () => {
    throw new Error('synthetic offline');
  }) as never;
  const client = createInboxQueryClient();
  client.mount();
  useEmailStore.getState()._initApi(mockOxy.http);
  const view = render(
    <QueryClientProvider client={client}>
      <InboxList />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));
  await waitFor(() =>
    expect(mockToast.error).toHaveBeenCalledWith('ui.mutations.reminderDeleteFailed'),
  );
  await act(async () => {
    onlineManager.setOnline(true);
    await client.getMutationCache().resumePausedMutations();
  });
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  view.unmount();
  client.unmount();
  client.clear();
});

it('reports an unavailable current account and does not send', async () => {
  globalThis.fetch = jest.fn() as never;
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <InboxList />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));
  await waitFor(() =>
    expect(mockToast.error).toHaveBeenCalledWith('ui.mutations.reminderSessionUnavailable'),
  );
  expect(globalThis.fetch).not.toHaveBeenCalled();
  view.unmount();
  client.clear();
});

it('retains the editor and blocks saving when the session changes after opening', async () => {
  globalThis.fetch = jest.fn() as never;
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  const view = render(
    <QueryClientProvider client={client}>
      <InboxList />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Synthetic' }));
  expect(screen.getByRole('region', { name: 'synthetic editor' })).toBeTruthy();
  act(() => {
    mockOxy.session.setAccessToken(token('alice', 'new-session'));
    mockRuntime.setActiveSessionId('new-session');
  });
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: 'save editor' }) as HTMLButtonElement).disabled,
    ).toBe(true),
  );
  expect(screen.getByText('ui.mutations.reminderEditorUnavailable')).toBeTruthy();
  expect(globalThis.fetch).not.toHaveBeenCalled();
  view.unmount();
  client.clear();
});

it('does not close a different reopened editor when an earlier save succeeds', async () => {
  let release!: (value: ReturnType<typeof response>) => void, begin!: () => void;
  const pending = new Promise<ReturnType<typeof response>>((r) => {
    release = r;
  });
  const started = new Promise<void>((r) => {
    begin = r;
  });
  globalThis.fetch = jest.fn(async () => {
    begin();
    return pending;
  }) as never;
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  const view = render(
    <QueryClientProvider client={client}>
      <InboxList />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Synthetic' }));
  fireEvent.click(screen.getByRole('button', { name: 'save editor' }));
  await started;
  fireEvent.click(screen.getByRole('button', { name: 'close editor' }));
  fireEvent.click(screen.getByRole('button', { name: 'Synthetic' }));
  const at = '2030-01-01T00:00:00.000Z';
  await act(async () =>
    release(
      response({
        data: {
          _id: 'synthetic-reminder',
          userId: 'alice',
          text: 'Changed',
          remindAt: at,
          completed: false,
          pinned: false,
          createdAt: at,
          updatedAt: at,
        },
      }),
    ),
  );
  await waitFor(() =>
    expect(client.getMutationCache().getAll().at(-1)?.state.status).toBe('success'),
  );
  expect(screen.getByRole('region', { name: 'synthetic editor' })).toBeTruthy();
  view.unmount();
  client.clear();
});

it('reports an unavailable account for a completion toggle without mentioning editor text', async () => {
  globalThis.fetch = jest.fn() as never;
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <InboxList />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'toggle reminder' }));
  await waitFor(() =>
    expect(mockToast.error).toHaveBeenCalledWith('ui.mutations.reminderUpdateUnavailable'),
  );
  expect(globalThis.fetch).not.toHaveBeenCalled();
  view.unmount();
  client.clear();
});
