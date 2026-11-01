import { act, renderHook, waitFor } from '@testing-library/react';
import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { OxyServices } from '@oxy.so/core';
import type { ReactNode } from 'react';
import { useEmailStore } from '@/hooks/useEmail';
import { createInboxQueryClient, INBOX_MUTATION_KEYS } from '@/hooks/queries/queryClient';
import { wireMessage } from '../fixtures/wire';

let mockOxy: OxyServices;
let mockUser = 'alice';
let mockRuntime: ReturnType<typeof import('@oxy.so/services/runtime').useOxyRuntime>;
jest.mock('@oxy.so/services/runtime', () => ({ useOxyRuntime: () => mockRuntime }));
jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({ oxyServices: mockOxy, user: { id: mockUser } }),
}));
jest.mock('@oxy.so/bloom/toast', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
import { useToggleStar } from '@/hooks/mutations/useMessageMutations';

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
  previousFetch = globalThis.fetch;
  mockUser = 'alice';
  mockOxy = new OxyServices({
    baseURL: 'https://api.test',
    enableRetry: false,
    enableCache: false,
  });
  mockOxy.session.setAccessToken(token('alice', 'a-session'));
  const { dirname, join } = require('node:path');
  const directory = dirname(require.resolve('@oxy.so/services/package.json'));
  const { createOxyRuntime } = require(
    join(directory, 'lib/commonjs/ui/runtime/createOxyRuntime.js'),
  );
  mockRuntime = createOxyRuntime({
    oxyServices: mockOxy,
    sessionClient: {
      getState: () => null,
      getDirectory: () => null,
      subscribe: () => () => {},
      refreshDirectory: async () => {},
      activateContext: async () => {},
      signOutContext: async () => {},
      signOutPrincipal: async () => {},
    },
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

it('rejects a retained live A hook before using bearer B after reconnect', async () => {
  onlineManager.setOnline(false);
  const sent: string[] = [];
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    sent.push(new Headers(init?.headers).get('authorization') ?? '');
    if (sent.length === 1) throw new Error('synthetic offline');
    return response({ data: wireMessage() });
  }) as never;
  const client = createInboxQueryClient();
  client.setDefaultOptions({
    ...client.getDefaultOptions(),
    mutations: { ...client.getDefaultOptions().mutations, retryDelay: 0 },
  });
  client.mount();
  useEmailStore.getState()._initApi(mockOxy.http);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(() => useToggleStar(), { wrapper });
  let operation!: Promise<unknown>;
  act(() => {
    operation = result.current
      .mutateAsync({ messageId: 'synthetic-A-message', starred: true })
      .catch((error) => error);
  });
  await waitFor(() =>
    expect(
      client.getMutationCache().find({ mutationKey: INBOX_MUTATION_KEYS.toggleStar })?.state
        .isPaused,
    ).toBe(true),
  );
  act(() => {
    mockUser = 'bob';
    mockOxy.session.setAccessToken(token('bob', 'b-session'));
    mockRuntime.batch(() => {
      mockRuntime.setAccount({ id: 'bob' } as never);
      mockRuntime.setActiveSessionId('b-session');
    });
  });
  await act(async () => {
    onlineManager.setOnline(true);
    await operation;
  });
  expect(sent).toEqual([`Bearer ${token('alice', 'a-session')}`]);
  unmount();
  client.unmount();
  client.clear();
});

it('observes the real account persister removing a paused A hook on A to B', async () => {
  const { dirname, join } = require('node:path');
  const sdkDirectory = dirname(require.resolve('@oxy.so/services/package.json'));
  const { createAccountQueryPersistence } = require(
    join(sdkDirectory, 'lib/commonjs/ui/hooks/accountQueryPersistence.js'),
  );
  const { INBOX_ACCOUNT_QUERIES } = require('@/hooks/queries/queryClient');
  onlineManager.setOnline(false);
  const sent: string[] = [];
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    sent.push(new Headers(init?.headers).get('authorization') ?? '');
    throw new Error('synthetic offline');
  }) as never;
  const values = new Map<string, string>();
  const storage = {
    getItem: async (k: string) => values.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      values.set(k, v);
    },
    removeItem: async (k: string) => {
      values.delete(k);
    },
  };
  const client = createInboxQueryClient();
  client.setDefaultOptions({
    ...client.getDefaultOptions(),
    mutations: { ...client.getDefaultOptions().mutations, retryDelay: 0 },
  });
  client.mount();
  const persistence = createAccountQueryPersistence(client, INBOX_ACCOUNT_QUERIES);
  persistence.setStorage(storage);
  persistence.attach();
  persistence.activate('alice');
  await persistence.whenReady();
  useEmailStore.getState()._initApi(mockOxy.http);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount, rerender } = renderHook(() => useToggleStar(), { wrapper });
  act(() => {
    result.current.mutate({ messageId: 'synthetic-A-message', starred: true });
  });
  await waitFor(() =>
    expect(
      client.getMutationCache().find({ mutationKey: INBOX_MUTATION_KEYS.toggleStar })?.state
        .isPaused,
    ).toBe(true),
  );
  const original = client.getMutationCache().find({ mutationKey: INBOX_MUTATION_KEYS.toggleStar });
  act(() => {
    mockUser = 'bob';
    mockOxy.session.setAccessToken(token('bob', 'b-session'));
    mockRuntime.batch(() => {
      mockRuntime.setAccount({ id: 'bob' });
      mockRuntime.setActiveSessionId('b-session');
    });
    persistence.activate('bob');
    rerender();
  });
  await persistence.whenReady();
  expect(client.getMutationCache().getAll()).not.toContain(original);
  await act(async () => {
    onlineManager.setOnline(true);
    await client.getMutationCache().resumePausedMutations();
  });
  expect(sent).toHaveLength(1);
  expect(original?.state.isPaused).toBe(true);
  unmount();
  persistence.detach();
  client.unmount();
  client.clear();
});

it('suppresses a late A rollback and retry after the real persister switches to B', async () => {
  const putSpy = jest.spyOn(mockOxy.http, 'put');
  const { dirname, join } = require('node:path');
  const sdkDirectory = dirname(require.resolve('@oxy.so/services/package.json'));
  const { createAccountQueryPersistence } = require(
    join(sdkDirectory, 'lib/commonjs/ui/hooks/accountQueryPersistence.js'),
  );
  const { INBOX_ACCOUNT_QUERIES } = require('@/hooks/queries/queryClient');
  const { emailKeys } = require('@/hooks/queries/queryKeys');
  let release!: (value: ReturnType<typeof response>) => void, started!: () => void;
  const inFlight = new Promise<ReturnType<typeof response>>((resolve) => {
    release = resolve;
  });
  const begun = new Promise<void>((resolve) => {
    started = resolve;
  });
  const sent: string[] = [];
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    sent.push(new Headers(init?.headers).get('authorization') ?? '');
    if (sent.length === 1) {
      started();
      return inFlight;
    }
    return {
      ...response({ error: 'synthetic forbidden' }),
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    };
  }) as never;
  const values = new Map<string, string>();
  let notifyB!: () => void;
  const bWritten = new Promise<void>((resolve) => {
    notifyB = resolve;
  });
  const storage = {
    getItem: async (k: string) => values.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      values.set(k, v);
      if (k === 'oxy_account_queries:bob') notifyB();
    },
    removeItem: async (k: string) => {
      values.delete(k);
    },
  };
  const client = createInboxQueryClient();
  client.setDefaultOptions({
    ...client.getDefaultOptions(),
    mutations: { ...client.getDefaultOptions().mutations, retryDelay: 0 },
  });
  client.mount();
  const persistence = createAccountQueryPersistence(client, INBOX_ACCOUNT_QUERIES);
  persistence.setStorage(storage);
  persistence.attach();
  persistence.activate('alice');
  await persistence.whenReady();
  useEmailStore.getState()._initApi(mockOxy.http);
  const oldKey = emailKeys.message.detail('synthetic-A-message', 'alice');
  const original = wireMessage({
    _id: 'synthetic-A-message',
    userId: 'alice',
    subject: 'synthetic-A-private',
  });
  client.setQueryData(oldKey, original);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount, rerender } = renderHook(() => useToggleStar(), { wrapper });
  let operation!: Promise<unknown>;
  act(() => {
    operation = result.current
      .mutateAsync({ messageId: 'synthetic-A-message', starred: true })
      .catch((error) => error);
  });
  await begun;
  const mutation = client.getMutationCache().find({ mutationKey: INBOX_MUTATION_KEYS.toggleStar });
  act(() => {
    mockUser = 'bob';
    mockOxy.session.setAccessToken(token('bob', 'b-session'));
    mockRuntime.batch(() => {
      mockRuntime.setAccount({ id: 'bob' });
      mockRuntime.setActiveSessionId('b-session');
    });
    persistence.activate('bob');
    rerender();
  });
  await persistence.whenReady();
  expect(client.getQueryData(oldKey)).toBeUndefined();
  expect(client.getMutationCache().getAll()).not.toContain(mutation);
  let resultError: unknown;
  await act(async () => {
    release(response({ data: wireMessage() }));
    resultError = await operation;
  });
  expect(putSpy).toHaveBeenCalledTimes(1);
  await expect(putSpy.mock.results[0].value).rejects.toMatchObject({
    code: 'AUTH_SESSION_CHANGED',
  });
  expect(resultError).toBeInstanceOf(Error);
  expect(sent).toEqual([`Bearer ${token('alice', 'a-session')}`]);
  expect(client.getQueryData(oldKey)).toBeUndefined();
  persistence.detach();
  await bWritten;
  expect(values.get('oxy_account_queries:bob')).not.toContain('synthetic-A-private');
  unmount();
  client.unmount();
  client.clear();
});

it.each([
  { name: 'same bearer', opaque: false, transition: 'same', resumes: true },
  {
    name: 'same-account signed-token refresh',
    opaque: false,
    transition: 'refresh',
    resumes: true,
  },
  { name: 'observed A to B to A', opaque: false, transition: 'aba', resumes: false },
  { name: 'same opaque bearer', opaque: true, transition: 'same', resumes: true },
  { name: 'different opaque bearer', opaque: true, transition: 'opaque-change', resumes: false },
  {
    name: 'sub-only bearer with matching projected session',
    opaque: false,
    transition: 'projection-sub',
    resumes: true,
  },
  {
    name: 'refresh before session projection',
    opaque: false,
    transition: 'projection-refresh',
    resumes: true,
  },
  {
    name: 'null session projection becomes known',
    opaque: false,
    transition: 'projection-fill',
    resumes: true,
  },
] as const)('handles offline retry with $name', async ({ opaque, transition, resumes }) => {
  const { dehydrate } = require('@tanstack/react-query');
  if (opaque) mockOxy.session.setAccessToken('synthetic-opaque-A');
  if (transition === 'projection-sub') {
    const payload = Buffer.from(
      JSON.stringify({ sub: 'alice', sessionId: 'a-session', exp: 2000000000 }),
    ).toString('base64url');
    mockOxy.session.setAccessToken(`e30.${payload}.fixture`);
  }
  if (transition.startsWith('projection-') && transition !== 'projection-aba')
    mockRuntime.setActiveSessionId(null);
  const initialBearer = mockOxy.http.getAccessToken();
  const initialEpoch = mockOxy.http.getSessionEpoch();
  onlineManager.setOnline(false);
  const sent: string[] = [];
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    sent.push(new Headers(init?.headers).get('authorization') ?? '');
    if (sent.length === 1) throw new Error('synthetic offline');
    return response({ data: wireMessage() });
  }) as never;
  const client = createInboxQueryClient();
  client.setDefaultOptions({
    ...client.getDefaultOptions(),
    mutations: { ...client.getDefaultOptions().mutations, retryDelay: 0 },
  });
  client.mount();
  useEmailStore.getState()._initApi(mockOxy.http);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(() => useToggleStar(), { wrapper });
  let operation!: Promise<unknown>;
  act(() => {
    operation = result.current
      .mutateAsync({ messageId: 'synthetic-A-message', starred: true })
      .catch((error) => error);
  });
  await waitFor(() =>
    expect(
      client.getMutationCache().find({ mutationKey: INBOX_MUTATION_KEYS.toggleStar })?.state
        .isPaused,
    ).toBe(true),
  );
  const state = dehydrate(client, { shouldDehydrateMutation: () => true });
  expect(state.mutations[0].state.variables).toEqual({
    messageId: 'synthetic-A-message',
    starred: true,
  });
  expect(JSON.stringify(state)).not.toContain(initialBearer ?? 'missing');
  act(() => {
    if (transition === 'refresh') {
      const payload = Buffer.from(
        JSON.stringify({ userId: 'alice', sessionId: 'a-session', exp: 2000000001, jti: 'new' }),
      ).toString('base64url');
      mockOxy.session.setAccessToken(`e30.${payload}.fixture`);
    } else if (transition === 'aba') {
      mockOxy.session.setAccessToken(token('bob', 'b-session'));
      mockRuntime.batch(() => {
        mockRuntime.setAccount({ id: 'bob' } as never);
        mockRuntime.setActiveSessionId('b-session');
      });
      mockOxy.session.setAccessToken(token('alice', 'a-session'));
      mockRuntime.batch(() => {
        mockRuntime.setAccount({ id: 'alice' } as never);
        mockRuntime.setActiveSessionId('a-session');
      });
    } else if (transition === 'opaque-change') mockOxy.session.setAccessToken('synthetic-opaque-B');
    else if (transition === 'projection-refresh') {
      const payload = Buffer.from(
        JSON.stringify({ userId: 'alice', sessionId: 'a-session', exp: 2000000001, jti: 'new' }),
      ).toString('base64url');
      mockOxy.session.setAccessToken(`e30.${payload}.fixture`);
      mockRuntime.setActiveSessionId('a-session');
    } else if (transition.startsWith('projection-')) mockRuntime.setActiveSessionId('a-session');
  });
  if (transition === 'refresh' || transition === 'same' || transition === 'projection-fill')
    expect(mockOxy.http.getSessionEpoch()).toBe(initialEpoch);
  if (transition === 'aba' || transition === 'opaque-change')
    expect(mockOxy.http.getSessionEpoch()).toBeGreaterThan(initialEpoch);
  let outcome: unknown;
  await act(async () => {
    onlineManager.setOnline(true);
    outcome = await operation;
  });
  // Core 7.10.5 omits Authorization for an undecodable opaque token.
  expect(sent[0]).toBe(opaque ? '' : `Bearer ${initialBearer}`);
  if (resumes) {
    expect(sent).toHaveLength(2);
    expect(sent[1]).toBe(opaque ? '' : `Bearer ${mockOxy.http.getAccessToken()}`);
    expect(outcome).not.toBeInstanceOf(Error);
  } else {
    expect(sent).toHaveLength(1);
    expect(outcome).toBeInstanceOf(Error);
  }
  unmount();
  client.unmount();
  client.clear();
});

it('rejects a known bearer subject that differs from the projected user', async () => {
  mockOxy.session.setAccessToken(token('bob', 'b-session'));
  globalThis.fetch = jest.fn() as never;
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(() => useToggleStar(), { wrapper });
  await act(async () => {
    await expect(
      result.current.mutateAsync({ messageId: 'synthetic-A', starred: true }),
    ).rejects.toThrow('Email account changed');
  });
  expect(globalThis.fetch).not.toHaveBeenCalled();
  unmount();
  client.clear();
});

it('does not apply optimism or call the API after the owner changes while cancellation waits', async () => {
  const { emailKeys } = require('@/hooks/queries/queryKeys');
  const client = createInboxQueryClient();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const cancel = jest.spyOn(client, 'cancelQueries').mockReturnValue(gate);
  globalThis.fetch = jest.fn() as never;
  useEmailStore.getState()._initApi(mockOxy.http);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount, rerender } = renderHook(() => useToggleStar(), { wrapper });
  let op!: Promise<unknown>;
  act(() => {
    op = result.current
      .mutateAsync({ messageId: 'synthetic-message', starred: true })
      .catch((error) => error);
  });
  await waitFor(() => expect(cancel).toHaveBeenCalled());
  const bKey = emailKeys.message.detail('synthetic-message', 'bob');
  const bData = wireMessage({ _id: 'synthetic-message', userId: 'bob', subject: 'synthetic-B' });
  act(() => {
    mockUser = 'bob';
    mockOxy.session.setAccessToken(token('bob', 'b-session'));
    mockRuntime.batch(() => {
      mockRuntime.setAccount({ id: 'bob' } as never);
      mockRuntime.setActiveSessionId('b-session');
    });
    client.setQueryData(bKey, bData);
    rerender();
  });
  await act(async () => {
    release();
    await op;
  });
  expect(client.getQueryData(bKey)).toEqual(bData);
  expect(globalThis.fetch).not.toHaveBeenCalled();
  unmount();
  client.clear();
});

it('does not execute a callback retained from the previous account', async () => {
  globalThis.fetch = jest.fn() as never;
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount, rerender } = renderHook(() => useToggleStar(), { wrapper });
  const old = result.current.mutateAsync;
  const success = jest.fn(),
    error = jest.fn(),
    settled = jest.fn();
  act(() => {
    mockUser = 'bob';
    mockOxy.session.setAccessToken(token('bob', 'b-session'));
    mockRuntime.batch(() => {
      mockRuntime.setAccount({ id: 'bob' } as never);
      mockRuntime.setActiveSessionId('b-session');
    });
    rerender();
  });
  await act(async () => {
    await expect(
      old(
        { messageId: 'synthetic-A', starred: true },
        { onSuccess: success, onError: error, onSettled: settled },
      ),
    ).rejects.toThrow('Email account changed');
  });
  expect(globalThis.fetch).not.toHaveBeenCalled();
  expect(success).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
  expect(settled).not.toHaveBeenCalled();
  unmount();
  client.clear();
});

it('keeps the star action stable across renders within an owner', async () => {
  let release!: (value: ReturnType<typeof response>) => void;
  let started!: () => void;
  const inFlight = new Promise<ReturnType<typeof response>>((resolve) => {
    release = resolve;
  });
  const begun = new Promise<void>((resolve) => {
    started = resolve;
  });
  globalThis.fetch = jest.fn(async () => {
    started();
    return inFlight;
  }) as never;
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount, rerender } = renderHook(() => useToggleStar(), { wrapper });
  const initial = result.current.mutate;
  rerender();
  expect(result.current.mutate).toBe(initial);
  let operation!: Promise<unknown>;
  act(() => {
    operation = result.current.mutateAsync({ messageId: 'synthetic-A', starred: true });
  });
  await begun;
  await waitFor(() => expect(result.current.isPending).toBe(true));
  expect(result.current.mutate).toBe(initial);
  await act(async () => {
    release(response({ data: wireMessage() }));
    await operation;
  });
  unmount();
  client.clear();
});
