import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { OxyServices } from '@oxy.so/core';
import { createInboxQueryClient, INBOX_ACCOUNT_QUERIES } from '@/hooks/queries/queryClient';
import { emailKeys } from '@/hooks/queries/queryKeys';
import { useEmailStore } from '@/hooks/useEmail';
let mockOxy: OxyServices;
let mockRuntime: ReturnType<typeof import('@oxy.so/services/runtime').useOxyRuntime>;
let mockUser = 'alice';
const mockToast = { success: jest.fn(), error: jest.fn() };
jest.mock('@oxy.so/services/runtime', () => ({ useOxyRuntime: () => mockRuntime }));
jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({
    oxyServices: mockOxy,
    user: { id: mockUser },
    canUsePrivateApi: true,
    isAccountCacheReady: true,
  }),
}));
jest.mock('@oxy.so/bloom/toast', () => ({ toast: mockToast }));
jest.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: { name?: string }) => (vars?.name ? `${key}:${vars.name}` : key),
  }),
}));
import { useUpdateBundle } from '@/hooks/mutations/useBundleMutations';
import { useBundles } from '@/hooks/queries/useBundles';
function token(user: string, session: string) {
  return `e30.${Buffer.from(JSON.stringify({ userId: user, sessionId: session, exp: 2000000000 })).toString('base64url')}.fixture`;
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
  previousFetch = globalThis.fetch;
  mockUser = 'alice';
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
function persistenceFor(client: ReturnType<typeof createInboxQueryClient>) {
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
function bundle(owner: string) {
  return {
    _id: 'shared',
    id: 'shared',
    userId: owner,
    name: owner,
    icon: 'mail',
    color: '#000000',
    matchLabels: [],
    enabled: true,
    collapsed: false,
    order: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}
function BundleControls() {
  const { data } = useBundles();
  const update = useUpdateBundle();
  return (
    <button
      type="button"
      onClick={() => update.mutate({ bundleId: data?.[0]?._id ?? 'shared', enabled: false })}
    >
      toggle
    </button>
  );
}
it('does not send an old bundle update or change B cache after account switch during cancellation', async () => {
  let release!: () => void, begin!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    begin = resolve;
  });
  const sent: string[] = [];
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      sent.push(new Headers(init.headers).get('authorization') ?? '');
      return response(bundle('bob'));
    }
    return response([bundle(mockUser)]);
  }) as never;
  const client = createInboxQueryClient();
  const persistence = persistenceFor(client);
  persistence.activate('alice');
  await persistence.whenReady();
  useEmailStore.getState()._initApi(mockOxy.http);
  client.setQueryData(emailKeys.bundles, [bundle('alice')]);
  jest.spyOn(client, 'cancelQueries').mockImplementation(async () => {
    begin();
    await gate;
  });
  const view = render(
    <QueryClientProvider client={client}>
      <BundleControls key={mockUser} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
  await started;
  const mutation = client.getMutationCache().getAll().at(-1);
  if (!mutation) throw new Error('Expected mutation');
  act(() => {
    mockUser = 'bob';
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
        <BundleControls key={mockUser} />
      </QueryClientProvider>,
    );
  });
  await persistence.whenReady();
  client.setQueryData(emailKeys.bundles, [bundle('bob')]);
  await act(async () => release());
  await waitFor(() => expect(mutation.state.status).not.toBe('pending'));
  expect(sent).toEqual([]);
  expect(client.getQueryData(emailKeys.bundles)).toEqual([bundle('bob')]);
  view.unmount();
  persistence.detach();
  client.clear();
});

it('keeps a same-account toggle optimistic and confirms it after success', async () => {
  let finish!: (value: ReturnType<typeof response>) => void, begin!: () => void;
  const reply = new Promise<ReturnType<typeof response>>((resolve) => {
    finish = resolve;
  });
  const started = new Promise<void>((resolve) => {
    begin = resolve;
  });
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      begin();
      return reply;
    }
    return response([bundle('alice')]);
  }) as never;
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  client.setQueryData(emailKeys.bundles, [bundle('alice')]);
  const view = render(
    <QueryClientProvider client={client}>
      <BundleControls />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
  await started;
  expect(client.getQueryData(emailKeys.bundles)).toEqual([{ ...bundle('alice'), enabled: false }]);
  await act(async () => {
    finish(response({ ...bundle('alice'), enabled: false }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await waitFor(() => expect(client.getMutationCache().getAll()[0]?.state.status).toBe('success'));
  expect(mockToast.error).not.toHaveBeenCalled();
  view.unmount();
  client.clear();
});

it('rolls back and reports a same-account failed toggle', async () => {
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'PUT') throw new Error('synthetic network failure');
    return response([bundle('alice')]);
  }) as never;
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  client.setQueryData(emailKeys.bundles, [bundle('alice')]);
  const view = render(
    <QueryClientProvider client={client}>
      <BundleControls />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
  await waitFor(() =>
    expect(mockToast.error).toHaveBeenCalledWith('ui.mutations.bundleUpdateFailed'),
  );
  expect(client.getQueryData(emailKeys.bundles)).toEqual([bundle('alice')]);
  view.unmount();
  client.clear();
});

it('suppresses old errors, rollback and invalidation after a request starts and the account changes', async () => {
  let reject!: (error: Error) => void, begin!: () => void;
  const reply = new Promise<ReturnType<typeof response>>((_resolve, r) => {
    reject = r;
  });
  const started = new Promise<void>((resolve) => {
    begin = resolve;
  });
  const sent: string[] = [];
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      sent.push(new Headers(init.headers).get('authorization') ?? '');
      begin();
      return reply;
    }
    return response([bundle(mockUser)]);
  }) as never;
  const client = createInboxQueryClient();
  const persistence = persistenceFor(client);
  persistence.activate('alice');
  await persistence.whenReady();
  useEmailStore.getState()._initApi(mockOxy.http);
  client.setQueryData(emailKeys.bundles, [bundle('alice')]);
  const view = render(
    <QueryClientProvider client={client}>
      <BundleControls key={mockUser} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
  await started;
  const mutation = client.getMutationCache().getAll().at(-1);
  if (!mutation) throw new Error('Expected mutation');
  act(() => {
    mockUser = 'bob';
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
        <BundleControls key={mockUser} />
      </QueryClientProvider>,
    );
  });
  await persistence.whenReady();
  client.setQueryData(emailKeys.bundles, [bundle('bob')]);
  const invalidations = jest.spyOn(client, 'invalidateQueries');
  await act(async () => {
    reject(new Error('synthetic network failure'));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await waitFor(() => expect(mutation.state.status).not.toBe('pending'));
  expect(sent).toEqual([`Bearer ${token('alice', 'a-session')}`]);
  expect(mockToast.error).not.toHaveBeenCalled();
  expect(invalidations).not.toHaveBeenCalled();
  expect(client.getQueryData(emailKeys.bundles)).toEqual([bundle('bob')]);
  view.unmount();
  persistence.detach();
  client.clear();
});

it('reports that a current session is unavailable and does not send', async () => {
  globalThis.fetch = jest.fn() as never;
  const client = createInboxQueryClient();
  client.setQueryData(emailKeys.bundles, [bundle('alice')]);
  const view = render(
    <QueryClientProvider client={client}>
      <BundleControls />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
  await waitFor(() =>
    expect(mockToast.error).toHaveBeenCalledWith('ui.mutations.bundleSessionUnavailable'),
  );
  expect(globalThis.fetch).not.toHaveBeenCalled();
  view.unmount();
  client.clear();
});

it('retries a paused same-owner toggle on reconnection', async () => {
  let attempts = 0;
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      attempts++;
      if (attempts === 1) throw new Error('synthetic offline');
      return response({ ...bundle('alice'), enabled: false });
    }
    return response([bundle('alice')]);
  }) as never;
  onlineManager.setOnline(false);
  const client = createInboxQueryClient();
  client.setDefaultOptions({
    ...client.getDefaultOptions(),
    mutations: { ...client.getDefaultOptions().mutations, retry: 1, retryDelay: 0 },
  });
  useEmailStore.getState()._initApi(mockOxy.http);
  client.setQueryData(emailKeys.bundles, [bundle('alice')]);
  const view = render(
    <QueryClientProvider client={client}>
      <BundleControls />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
  await waitFor(() => expect(client.getMutationCache().getAll()[0]?.state.isPaused).toBe(true));
  act(() => onlineManager.setOnline(true));
  await waitFor(() => expect(client.getMutationCache().getAll()[0]?.state.status).toBe('success'));
  expect(attempts).toBe(2);
  expect(mockToast.error).not.toHaveBeenCalled();
  view.unmount();
  client.clear();
});

it('does not retry a paused A toggle after A to B to A', async () => {
  let attempts = 0;
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      attempts++;
      throw new Error('synthetic offline');
    }
    return response([bundle(mockUser)]);
  }) as never;
  onlineManager.setOnline(false);
  const client = createInboxQueryClient();
  client.setDefaultOptions({
    ...client.getDefaultOptions(),
    mutations: { ...client.getDefaultOptions().mutations, retry: 1, retryDelay: 0 },
  });
  const persistence = persistenceFor(client);
  persistence.activate('alice');
  await persistence.whenReady();
  useEmailStore.getState()._initApi(mockOxy.http);
  client.setQueryData(emailKeys.bundles, [bundle('alice')]);
  const view = render(
    <QueryClientProvider client={client}>
      <BundleControls key={mockUser} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
  await waitFor(() => expect(client.getMutationCache().getAll()[0]?.state.isPaused).toBe(true));
  const mutation = client.getMutationCache().getAll()[0];
  act(() => {
    mockUser = 'bob';
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
        <BundleControls key={mockUser} />
      </QueryClientProvider>,
    );
  });
  await persistence.whenReady();
  act(() => {
    mockUser = 'alice';
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
        <BundleControls key={mockUser} />
      </QueryClientProvider>,
    );
  });
  await persistence.whenReady();
  act(() => onlineManager.setOnline(true));
  await waitFor(() => expect(mutation.state.status).not.toBe('pending'));
  expect(attempts).toBe(1);
  expect(mockToast.error).not.toHaveBeenCalled();
  view.unmount();
  persistence.detach();
  client.clear();
});
