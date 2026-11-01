import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { dehydrate, onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { OxyServices } from '@oxy.so/core';
import { createInboxQueryClient, INBOX_ACCOUNT_QUERIES } from '@/hooks/queries/queryClient';
import { emailKeys } from '@/hooks/queries/queryKeys';
import { useEmailStore } from '@/hooks/useEmail';

let mockOxy: OxyServices;
let mockRuntime: ReturnType<typeof import('@oxy.so/services/runtime').useOxyRuntime>;
const mockTranslate = (key: string) => key;
const mockToast = { success: jest.fn(), error: jest.fn() };
jest.mock('@oxy.so/services/runtime', () => ({ useOxyRuntime: () => mockRuntime }));
jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => {
    const { useSyncExternalStore } = require('react');
    const snapshot = useSyncExternalStore(
      mockRuntime.subscribe,
      mockRuntime.getSnapshot,
      mockRuntime.getSnapshot,
    );
    return { user: snapshot.account, oxyServices: mockOxy };
  },
}));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: mockTranslate }) }));
jest.mock('@oxy.so/bloom/toast', () => ({ toast: mockToast }));
jest.mock('react-native', () => ({
  View: ({ children }: { children: ReactNode }) => children,
  RefreshControl: () => null,
  StyleSheet: { create: (v: unknown) => v },
  useWindowDimensions: () => ({ width: 800 }),
  Platform: { OS: 'web', select: (v: { web?: unknown; default?: unknown }) => v.web ?? v.default },
}));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { createAnimatedComponent: (component: unknown) => component },
}));
jest.mock('@shopify/flash-list', () => ({
  FlashList: ({
    data,
    renderItem,
  }: {
    data: { _id: string }[];
    renderItem: (item: { item: { _id: string } }) => ReactNode;
  }) => (
    <>
      {data.map((item) => (
        <span key={item._id}>{renderItem({ item })}</span>
      ))}
    </>
  ),
}));
jest.mock('@oxy.so/bloom/styles', () => ({ BREAKPOINTS: { md: 700 } }));
jest.mock('@oxy.so/bloom/design-tokens', () => ({ SPACING: { 'space-2': 4 } }));
jest.mock('@oxy.so/bloom/layout', () => ({
  ScrollMetricsProvider: ({ children }: { children: ReactNode }) => children,
  TopEdgeProvider: ({ children }: { children: ReactNode }) => children,
  useBottomEdgeInset: () => 0,
  useTopEdgeInset: () => 0,
  useAnimatedScrollMetricsBinding: () => ({}),
}));
jest.mock('@oxy.so/bloom/scroll', () => ({
  ScrollRestorationProvider: ({ children }: { children: ReactNode }) => children,
  useScrollRestoration: () => ({}),
}));
jest.mock('@oxy.so/bloom/scroll/expo-router', () => ({ expoRouterScrollAdapter: {} }));
jest.mock('@oxy.so/bloom/tab-bar', () => ({ useMinimizeOnScroll: () => () => {} }));
jest.mock('@oxy.so/bloom/page-header', () => ({ PageHeader: () => null }));
jest.mock('@oxy.so/bloom/app-shell', () => ({ useAppShell: () => ({ drawerAvailable: false }) }));
jest.mock('@oxy.so/bloom/button-group', () => ({
  ButtonGroup: () => null,
  ButtonGroupItem: () => null,
}));
jest.mock('@oxy.so/bloom/divider', () => ({ Divider: () => null }));
jest.mock('@oxy.so/bloom/empty-state', () => ({ EmptyState: () => null }));
jest.mock('@oxy.so/bloom/loading', () => ({ Loading: () => null }));
jest.mock('@oxy.so/bloom/typography', () => ({
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
jest.mock('@oxy.so/bloom/item', () => ({
  Item: ({ title, trailing }: { title: string; trailing: ReactNode }) => (
    <section>
      {title}
      {trailing}
    </section>
  ),
}));
jest.mock('@oxy.so/bloom/button', () => ({
  Button: ({
    children,
    onPress,
    disabled,
    loading,
  }: {
    children: ReactNode;
    onPress?: () => void;
    disabled?: boolean;
    loading?: boolean;
  }) => (
    <button type="button" onClick={onPress} disabled={disabled} aria-busy={loading || undefined}>
      {children}
    </button>
  ),
}));
jest.mock('@/constants/theme', () => ({
  useColors: () => ({ text: 'black', secondaryText: 'gray' }),
}));
jest.mock('@/components/Avatar', () => ({ SenderAvatar: () => null }));
jest.mock('@/components/SubscriptionStacks', () => ({ SubscriptionStacks: () => null }));
jest.mock('@/components/EmptyStateSticker', () => ({ EmptyStateSticker: () => null }));
jest.mock('@/hooks/useGoBack', () => ({ useGoBack: () => () => {} }));
import { SubscriptionsScreen } from '@/components/SubscriptionsScreen';

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
function page(name: string) {
  return {
    pages: [
      {
        data: [
          {
            _id: 'news@example.test',
            name,
            messageCount: 3,
            readCount: 0,
            latestDate: '2026-01-01',
            oldestDate: '2025-01-01',
            latestMessageId: 'synthetic',
            hasListUnsubscribe: true,
            type: 'list-unsubscribe',
          },
        ],
        pagination: { total: 1, limit: 30, offset: 0, hasMore: false },
      },
    ],
    pageParams: [0],
  };
}
let previousFetch: typeof fetch;
beforeEach(() => {
  jest.clearAllMocks();
  previousFetch = globalThis.fetch;
  mockOxy = new OxyServices({
    baseURL: 'https://api.test',
    enableRetry: true,
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
function persistenceFor(client: ReturnType<typeof createInboxQueryClient>) {
  const { dirname, join } = require('node:path');
  const dir = dirname(require.resolve('@oxy.so/services/package.json'));
  const { createAccountQueryPersistence } = require(
    join(dir, 'lib/commonjs/ui/hooks/accountQueryPersistence.js'),
  );
  const map = new Map<string, string>();
  const storage = {
    getItem: async (k: string) => map.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: async (k: string) => {
      map.delete(k);
    },
  };
  const persistence = createAccountQueryPersistence(client, INBOX_ACCOUNT_QUERIES);
  persistence.setStorage(storage);
  persistence.attach();
  return persistence;
}
function AccountScreen() {
  const { useSyncExternalStore } = require('react');
  const snapshot = useSyncExternalStore(
    mockRuntime.subscribe,
    mockRuntime.getSnapshot,
    mockRuntime.getSnapshot,
  );
  return <SubscriptionsScreen key={snapshot.account?.id ?? 'none'} />;
}

it('does not send A unsubscribe under B or mark B cache after cancellation is delayed', async () => {
  let unblock!: () => void, finish!: (value: ReturnType<typeof response>) => void;
  const cancelGate = new Promise<void>((resolve) => {
    unblock = resolve;
  });
  const reply = new Promise<ReturnType<typeof response>>((resolve) => {
    finish = resolve;
  });
  const requests: string[] = [];
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'GET') return response(page('B synthetic').pages[0]);
    requests.push(new Headers(init?.headers).get('authorization') ?? '');
    return reply;
  }) as never;
  const client = createInboxQueryClient();
  client.mount();
  const persistence = persistenceFor(client);
  persistence.activate('alice');
  await persistence.whenReady();
  useEmailStore.getState()._initApi(mockOxy.http);
  client.setQueryData(emailKeys.subscriptions, page('A synthetic'));
  const cancel = jest.spyOn(client, 'cancelQueries').mockImplementation(() => cancelGate);
  const view = render(
    <QueryClientProvider client={client}>
      <AccountScreen />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'subscriptions.unsubscribe' }));
  await waitFor(() => expect(cancel).toHaveBeenCalled());
  act(() => {
    mockOxy.session.setAccessToken(token('bob', 'b-session'));
    mockRuntime.batch(() => {
      mockRuntime.setAccount({ id: 'bob' });
      mockRuntime.setActiveSessionId('b-session');
    });
    useEmailStore.getState().resetAccountScopedState();
    useEmailStore.getState()._initApi(mockOxy.http);
    persistence.activate('bob');
  });
  await persistence.whenReady();
  act(() => client.setQueryData(emailKeys.subscriptions, page('B synthetic')));
  await waitFor(() => expect(screen.getByText('B synthetic')).toBeTruthy());
  await act(async () => {
    unblock();
    await Promise.resolve();
    await Promise.resolve();
  });
  try {
    expect(
      (client.getQueryData(emailKeys.subscriptions) as ReturnType<typeof page>).pages[0].data[0],
    ).not.toHaveProperty('unsubscribed', true);
    expect(requests).toEqual([]);
  } finally {
    finish({
      ...response({ error: 'forbidden' }),
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    });
    await act(async () => {
      await Promise.resolve();
    });
    persistence.detach();
    view.unmount();
    client.unmount();
    client.clear();
  }
});

it('shows pending without confirming until the same-owner POST succeeds', async () => {
  let release!: (value: ReturnType<typeof response>) => void, begun!: () => void;
  const reply = new Promise<ReturnType<typeof response>>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    begun = resolve;
  });
  const posts: string[] = [];
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'POST') {
      posts.push(new Headers(init.headers).get('authorization') ?? '');
      begun();
      return reply;
    }
    return response(page('A synthetic').pages[0]);
  }) as never;
  const client = createInboxQueryClient();
  client.mount();
  useEmailStore.getState()._initApi(mockOxy.http);
  client.setQueryData(emailKeys.subscriptions, page('A synthetic'));
  const view = render(
    <QueryClientProvider client={client}>
      <AccountScreen />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'subscriptions.unsubscribe' }));
  await started;
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: 'subscriptions.unsubscribe' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true),
  );
  expect(
    screen.getByRole('button', { name: 'subscriptions.unsubscribe' }).getAttribute('aria-busy'),
  ).toBe('true');
  expect(
    (client.getQueryData(emailKeys.subscriptions) as ReturnType<typeof page>).pages[0].data[0],
  ).not.toHaveProperty('unsubscribed', true);
  await act(async () => {
    release(response({ data: { success: true, method: 'one-click' } }));
  });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'subscriptions.unsubscribed' })).toBeTruthy(),
  );
  expect(posts).toEqual([`Bearer ${token('alice', 'a-session')}`]);
  expect(mockToast.success).toHaveBeenCalledWith('subscriptions.toast.unsubscribed');
  view.unmount();
  client.unmount();
  client.clear();
});

it('does not retry a failed non-idempotent request after reconnecting', async () => {
  let posts = 0;
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'POST') {
      posts++;
      throw new Error('offline');
    }
    return response(page('A synthetic').pages[0]);
  }) as never;
  const client = createInboxQueryClient();
  client.mount();
  useEmailStore.getState()._initApi(mockOxy.http);
  client.setQueryData(emailKeys.subscriptions, page('A synthetic'));
  const view = render(
    <QueryClientProvider client={client}>
      <AccountScreen />
    </QueryClientProvider>,
  );
  act(() => onlineManager.setOnline(false));
  fireEvent.click(screen.getByRole('button', { name: 'subscriptions.unsubscribe' }));
  await waitFor(() =>
    expect(mockToast.error).toHaveBeenCalledWith('subscriptions.toast.unconfirmed'),
  );
  expect(posts).toBe(1);
  expect(
    (screen.getByRole('button', { name: 'subscriptions.unsubscribe' }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
  act(() => onlineManager.setOnline(true));
  await act(async () => {
    await Promise.resolve();
  });
  expect(posts).toBe(1);
  view.unmount();
  client.unmount();
  client.clear();
});

it('does not restore A snapshot or show a late A error after B is mounted', async () => {
  let release!: (value: ReturnType<typeof response>) => void, begun!: () => void;
  const reply = new Promise<ReturnType<typeof response>>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    begun = resolve;
  });
  const posts: string[] = [];
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'POST') {
      posts.push(new Headers(init.headers).get('authorization') ?? '');
      begun();
      return reply;
    }
    return response(page('B synthetic').pages[0]);
  }) as never;
  const client = createInboxQueryClient();
  client.mount();
  const persistence = persistenceFor(client);
  persistence.activate('alice');
  await persistence.whenReady();
  useEmailStore.getState()._initApi(mockOxy.http);
  client.setQueryData(emailKeys.subscriptions, page('A synthetic'));
  const view = render(
    <QueryClientProvider client={client}>
      <AccountScreen />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'subscriptions.unsubscribe' }));
  await started;
  const mutation = client.getMutationCache().getAll()[0];
  const forced = dehydrate(client, { shouldDehydrateMutation: () => true });
  expect(JSON.stringify(forced)).not.toContain(token('alice', 'a-session'));
  const { dirname, join } = require('node:path');
  const dir = dirname(require.resolve('@oxy.so/services/package.json'));
  const { accountQueryOwnership } = require(
    join(dir, 'lib/commonjs/ui/hooks/accountQueryPersistence.js'),
  );
  const ownership = accountQueryOwnership(INBOX_ACCOUNT_QUERIES);
  expect(mutation.options.mutationKey).toBeUndefined();
  expect(ownership.persistsMutation(mutation)).toBe(false);
  act(() => {
    mockOxy.session.setAccessToken(token('bob', 'b-session'));
    mockRuntime.batch(() => {
      mockRuntime.setAccount({ id: 'bob' });
      mockRuntime.setActiveSessionId('b-session');
    });
    useEmailStore.getState().resetAccountScopedState();
    useEmailStore.getState()._initApi(mockOxy.http);
    persistence.activate('bob');
  });
  await persistence.whenReady();
  act(() => client.setQueryData(emailKeys.subscriptions, page('B synthetic')));
  await waitFor(() => expect(screen.getByText('B synthetic')).toBeTruthy());
  const invalidations = jest.spyOn(client, 'invalidateQueries');
  await act(async () => {
    release({
      ...response({ error: 'forbidden' }),
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    });
    await waitFor(() => expect(mutation.state.status).toBe('error'));
  });
  expect(posts).toEqual([`Bearer ${token('alice', 'a-session')}`]);
  expect(screen.getByText('B synthetic')).toBeTruthy();
  expect(mockToast.error).not.toHaveBeenCalled();
  expect(mockToast.success).not.toHaveBeenCalled();
  expect(invalidations).not.toHaveBeenCalled();
  persistence.detach();
  view.unmount();
  client.unmount();
  client.clear();
});

it('shows a current-account not-ready message and leaves the subscription actionable', async () => {
  const fetchSpy = jest.fn();
  globalThis.fetch = fetchSpy as never;
  const client = createInboxQueryClient();
  client.setQueryData(emailKeys.subscriptions, page('A synthetic'));
  const view = render(
    <QueryClientProvider client={client}>
      <AccountScreen />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'subscriptions.unsubscribe' }));
  await waitFor(() =>
    expect(mockToast.error).toHaveBeenCalledWith('subscriptions.toast.sessionUnavailable'),
  );
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(
    (screen.getByRole('button', { name: 'subscriptions.unsubscribe' }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
  view.unmount();
  client.clear();
});

it('does not send a retained A action after A→B→A bearer changes', async () => {
  const { renderHook } = require('@testing-library/react');
  const { useUnsubscribe } = require('@/hooks/mutations/useUnsubscribe');
  const fetchSpy = jest.fn();
  globalThis.fetch = fetchSpy as never;
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, rerender, unmount } = renderHook(() => useUnsubscribe(), { wrapper });
  const retained = result.current.mutateAsync;
  act(() => {
    mockOxy.session.setAccessToken(token('bob', 'b-session'));
    mockRuntime.setAccount({ id: 'bob' });
    mockOxy.session.setAccessToken(token('alice', 'a-session'));
    mockRuntime.setAccount({ id: 'alice' });
    rerender();
  });
  await act(async () => {
    await retained({ senderAddress: 'news@example.test', method: 'list-unsubscribe' }).catch(
      () => {},
    );
  });
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(mockToast.error).not.toHaveBeenCalled();
  unmount();
  client.clear();
});

it('keeps a later successful sender marked when an earlier unsubscribe fails', async () => {
  let failFirst!: (value: ReturnType<typeof response>) => void,
    successSecond!: (value: ReturnType<typeof response>) => void;
  const first = new Promise<ReturnType<typeof response>>((r) => {
      failFirst = r;
    }),
    second = new Promise<ReturnType<typeof response>>((r) => {
      successSecond = r;
    });
  let posts = 0;
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'POST') {
      posts++;
      return posts === 1 ? first : second;
    }
    return response(page('A synthetic').pages[0]);
  }) as never;
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  const cache = page('First');
  cache.pages[0].data.push({
    ...cache.pages[0].data[0],
    _id: 'other@example.test',
    name: 'Second',
  });
  client.setQueryData(emailKeys.subscriptions, cache);
  const view = render(
    <QueryClientProvider client={client}>
      <AccountScreen />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getAllByRole('button', { name: 'subscriptions.unsubscribe' })[0]);
  await waitFor(() => expect(posts).toBe(1));
  fireEvent.click(screen.getAllByRole('button', { name: 'subscriptions.unsubscribe' })[1]);
  await waitFor(() => expect(posts).toBe(2));
  expect(
    screen
      .getAllByRole('button', { name: 'subscriptions.unsubscribe' })
      .every((button) => button.getAttribute('aria-busy') === 'true'),
  ).toBe(true);
  await act(async () => {
    successSecond(response({ data: { success: true, method: 'one-click' } }));
  });
  await waitFor(() => expect(mockToast.success).toHaveBeenCalled());
  await act(async () => {
    failFirst({
      ...response({ error: 'forbidden' }),
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    });
  });
  await waitFor(() => expect(mockToast.error).toHaveBeenCalled());
  const rows = (client.getQueryData(emailKeys.subscriptions) as ReturnType<typeof page>).pages[0]
    .data;
  expect(rows.find((r) => r._id === 'other@example.test')).toHaveProperty('unsubscribed', true);
  view.unmount();
  client.clear();
});

it('does not persist a pending unsubscribe as confirmed after restart', async () => {
  let begun!: () => void, finish!: (value: ReturnType<typeof response>) => void;
  const started = new Promise<void>((resolve) => {
      begun = resolve;
    }),
    reply = new Promise<ReturnType<typeof response>>((resolve) => {
      finish = resolve;
    });
  globalThis.fetch = jest.fn(async () => {
    begun();
    return reply;
  }) as never;
  const { dirname, join } = require('node:path');
  const dir = dirname(require.resolve('@oxy.so/services/package.json'));
  const { createAccountQueryPersistence } = require(
    join(dir, 'lib/commonjs/ui/hooks/accountQueryPersistence.js'),
  );
  const values = new Map<string, string>();
  let saved!: () => void;
  const written = new Promise<void>((resolve) => {
    saved = resolve;
  });
  const storage = {
    getItem: async (k: string) => values.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      values.set(k, v);
      saved();
    },
    removeItem: async (k: string) => {
      values.delete(k);
    },
  };
  const client = createInboxQueryClient();
  const persistence = createAccountQueryPersistence(client, INBOX_ACCOUNT_QUERIES);
  persistence.setStorage(storage);
  persistence.attach();
  persistence.activate('alice');
  await persistence.whenReady();
  useEmailStore.getState()._initApi(mockOxy.http);
  client.setQueryData(emailKeys.subscriptions, page('A synthetic'));
  const view = render(
    <QueryClientProvider client={client}>
      <AccountScreen />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'subscriptions.unsubscribe' }));
  await started;
  expect(
    (client.getQueryData(emailKeys.subscriptions) as ReturnType<typeof page>).pages[0].data[0],
  ).not.toHaveProperty('unsubscribed', true);
  const mutation = client.getMutationCache().getAll()[0];
  persistence.detach();
  await written;
  view.unmount();
  const restored = createInboxQueryClient(),
    next = createAccountQueryPersistence(restored, INBOX_ACCOUNT_QUERIES);
  next.setStorage(storage);
  next.attach();
  next.activate('alice');
  await next.whenReady();
  expect(
    (restored.getQueryData(emailKeys.subscriptions) as ReturnType<typeof page>).pages[0].data[0],
  ).not.toHaveProperty('unsubscribed', true);
  await act(async () => {
    finish({
      ...response({ error: 'forbidden' }),
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    });
    await waitFor(() => expect(mutation.state.status).toBe('error'));
  });
  next.detach();
  restored.clear();
  client.clear();
});

it('rejects duplicate same-row clicks before React commits the pending state', async () => {
  let finish!: (value: ReturnType<typeof response>) => void, begun!: () => void;
  const reply = new Promise<ReturnType<typeof response>>((resolve) => {
      finish = resolve;
    }),
    started = new Promise<void>((resolve) => {
      begun = resolve;
    });
  let posts = 0;
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'POST') {
      posts++;
      begun();
      return reply;
    }
    return response(page('A synthetic').pages[0]);
  }) as never;
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  client.setQueryData(emailKeys.subscriptions, page('A synthetic'));
  const view = render(
    <QueryClientProvider client={client}>
      <AccountScreen />
    </QueryClientProvider>,
  );
  const button = screen.getByRole('button', { name: 'subscriptions.unsubscribe' });
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await started;
  expect(posts).toBe(1);
  expect(button.getAttribute('aria-busy')).toBe('true');
  await act(async () => {
    finish(response({ data: { success: true, method: 'one-click' } }));
  });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'subscriptions.unsubscribed' })).toBeTruthy(),
  );
  expect(posts).toBe(1);
  view.unmount();
  client.clear();
});

it('does not let a GET started during POST overwrite the confirmed unsubscribe', async () => {
  let releasePost!: (value: ReturnType<typeof response>) => void,
    postBegun!: () => void,
    releaseGet!: (value: ReturnType<typeof response>) => void,
    getBegun!: () => void;
  const postReply = new Promise<ReturnType<typeof response>>((resolve) => {
      releasePost = resolve;
    }),
    started = new Promise<void>((resolve) => {
      postBegun = resolve;
    }),
    staleReply = new Promise<ReturnType<typeof response>>((resolve) => {
      releaseGet = resolve;
    }),
    getStarted = new Promise<void>((resolve) => {
      getBegun = resolve;
    });
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'POST') {
      postBegun();
      return postReply;
    }
    getBegun();
    return staleReply;
  }) as never;
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  client.setQueryData(emailKeys.subscriptions, page('A synthetic'));
  const view = render(
    <QueryClientProvider client={client}>
      <AccountScreen />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'subscriptions.unsubscribe' }));
  await started;
  let query!: Promise<unknown>;
  act(() => {
    query = client.refetchQueries({ queryKey: emailKeys.subscriptions }).catch(() => {});
  });
  await getStarted;
  expect(client.getQueryState(emailKeys.subscriptions)?.fetchStatus).toBe('fetching');
  await act(async () => {
    releasePost(response({ data: { success: true, method: 'one-click' } }));
  });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'subscriptions.unsubscribed' })).toBeTruthy(),
  );
  await act(async () => {
    releaseGet(response(page('A synthetic').pages[0]));
    await query;
  });
  expect(
    (client.getQueryData(emailKeys.subscriptions) as ReturnType<typeof page>).pages[0].data[0],
  ).toHaveProperty('unsubscribed', true);
  view.unmount();
  client.clear();
});

it('suppresses confirmation if account changes while the post-success GET is being cancelled', async () => {
  let releaseCancel!: () => void, startedCancel!: () => void;
  const cancelGate = new Promise<void>((resolve) => {
      releaseCancel = resolve;
    }),
    cancelStarted = new Promise<void>((resolve) => {
      startedCancel = resolve;
    });
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) =>
    init?.method === 'POST'
      ? response({ data: { success: true, method: 'one-click' } })
      : response(page('B synthetic').pages[0]),
  ) as never;
  const client = createInboxQueryClient();
  const persistence = persistenceFor(client);
  persistence.activate('alice');
  await persistence.whenReady();
  useEmailStore.getState()._initApi(mockOxy.http);
  client.setQueryData(emailKeys.subscriptions, page('A synthetic'));
  const cancel = jest.spyOn(client, 'cancelQueries');
  let calls = 0;
  cancel.mockImplementation(() => {
    calls++;
    if (calls === 2) {
      startedCancel();
      return cancelGate;
    }
    return Promise.resolve();
  });
  const view = render(
    <QueryClientProvider client={client}>
      <AccountScreen />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'subscriptions.unsubscribe' }));
  await cancelStarted;
  act(() => {
    mockOxy.session.setAccessToken(token('bob', 'b-session'));
    mockRuntime.batch(() => {
      mockRuntime.setAccount({ id: 'bob' });
      mockRuntime.setActiveSessionId('b-session');
    });
    useEmailStore.getState().resetAccountScopedState();
    useEmailStore.getState()._initApi(mockOxy.http);
    persistence.activate('bob');
  });
  await persistence.whenReady();
  act(() => client.setQueryData(emailKeys.subscriptions, page('B synthetic')));
  await waitFor(() => expect(screen.getByText('B synthetic')).toBeTruthy());
  await act(async () => {
    releaseCancel();
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(
    (client.getQueryData(emailKeys.subscriptions) as ReturnType<typeof page>).pages[0].data[0],
  ).not.toHaveProperty('unsubscribed', true);
  expect(mockToast.success).not.toHaveBeenCalled();
  expect(mockToast.error).not.toHaveBeenCalled();
  persistence.detach();
  view.unmount();
  client.clear();
});

it('does not present a server success=false response as an unsubscribe', async () => {
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) =>
    init?.method === 'POST'
      ? response({ data: { success: false, method: 'one-click' } })
      : response(page('A synthetic').pages[0]),
  ) as never;
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  client.setQueryData(emailKeys.subscriptions, page('A synthetic'));
  const view = render(
    <QueryClientProvider client={client}>
      <AccountScreen />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'subscriptions.unsubscribe' }));
  await waitFor(() =>
    expect(mockToast.error).toHaveBeenCalledWith('subscriptions.toast.unconfirmed'),
  );
  expect(
    (client.getQueryData(emailKeys.subscriptions) as ReturnType<typeof page>).pages[0].data[0],
  ).not.toHaveProperty('unsubscribed', true);
  expect(mockToast.success).not.toHaveBeenCalled();
  view.unmount();
  client.clear();
});

it('keeps B pending when A settles after the account changes without remounting the screen', async () => {
  let releaseA!: (value: ReturnType<typeof response>) => void,
    releaseB!: (value: ReturnType<typeof response>) => void,
    startA!: () => void,
    startB!: () => void;
  const replyA = new Promise<ReturnType<typeof response>>((resolve) => {
      releaseA = resolve;
    }),
    replyB = new Promise<ReturnType<typeof response>>((resolve) => {
      releaseB = resolve;
    }),
    beganA = new Promise<void>((resolve) => {
      startA = resolve;
    }),
    beganB = new Promise<void>((resolve) => {
      startB = resolve;
    });
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const bearer = new Headers(init.headers).get('authorization');
      if (bearer === `Bearer ${token('alice', 'a-session')}`) {
        startA();
        return replyA;
      }
      startB();
      return replyB;
    }
    return response(page('B synthetic').pages[0]);
  }) as never;
  const client = createInboxQueryClient(),
    persistence = persistenceFor(client);
  persistence.activate('alice');
  await persistence.whenReady();
  useEmailStore.getState()._initApi(mockOxy.http);
  client.setQueryData(emailKeys.subscriptions, page('A synthetic'));
  // Deliberately keep one screen mounted to exercise its owner-scoped pending map.
  const view = render(
    <QueryClientProvider client={client}>
      <SubscriptionsScreen />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'subscriptions.unsubscribe' }));
  await beganA;
  act(() => {
    mockOxy.session.setAccessToken(token('bob', 'b-session'));
    mockRuntime.batch(() => {
      mockRuntime.setAccount({ id: 'bob' });
      mockRuntime.setActiveSessionId('b-session');
    });
    useEmailStore.getState().resetAccountScopedState();
    useEmailStore.getState()._initApi(mockOxy.http);
    persistence.activate('bob');
  });
  await persistence.whenReady();
  act(() => client.setQueryData(emailKeys.subscriptions, page('B synthetic')));
  await waitFor(() => expect(screen.getByText('B synthetic')).toBeTruthy());
  const bButton = screen.getByRole('button', { name: 'subscriptions.unsubscribe' });
  expect((bButton as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(bButton);
  await beganB;
  expect(bButton.getAttribute('aria-busy')).toBe('true');
  await act(async () => {
    releaseA({
      ...response({ error: 'forbidden' }),
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    });
    await Promise.resolve();
    await Promise.resolve();
  });
  expect((bButton as HTMLButtonElement).disabled).toBe(true);
  expect(bButton.getAttribute('aria-busy')).toBe('true');
  expect(mockToast.error).not.toHaveBeenCalled();
  await act(async () => {
    releaseB(response({ data: { success: true, method: 'one-click' } }));
  });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'subscriptions.unsubscribed' })).toBeTruthy(),
  );
  expect(mockToast.success).toHaveBeenCalledTimes(1);
  persistence.detach();
  view.unmount();
  client.clear();
});
