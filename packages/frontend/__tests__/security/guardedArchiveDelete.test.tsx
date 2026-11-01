import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { dehydrate, onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { OxyServices } from '@oxy.so/core';
import { useEmailStore } from '@/hooks/useEmail';
import {
  createInboxQueryClient,
  INBOX_MUTATION_KEYS,
  INBOX_ACCOUNT_QUERIES,
} from '@/hooks/queries/queryClient';
import { emailKeys } from '@/hooks/queries/queryKeys';
import { wireMessage } from '../fixtures/wire';

let mockOxy: OxyServices;
let mockUser = 'alice';
let mockRuntime: ReturnType<typeof import('@oxy.so/services/runtime').useOxyRuntime>;
const mockTranslate = (key: string) => key;
jest.mock('@oxy.so/services/runtime', () => ({ useOxyRuntime: () => mockRuntime }));
jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({ oxyServices: mockOxy, user: { id: mockUser } }),
}));
jest.mock('@oxy.so/bloom/toast', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: mockTranslate }) }));
import { useArchiveMessage, useDeleteMessage } from '@/hooks/mutations/useMessageMutations';

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
  const dir = dirname(require.resolve('@oxy.so/services/package.json'));
  const { createOxyRuntime } = require(join(dir, 'lib/commonjs/ui/runtime/createOxyRuntime.js'));
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
function switchToBob() {
  mockUser = 'bob';
  mockOxy.session.setAccessToken(token('bob', 'b-session'));
  mockRuntime.batch(() => {
    mockRuntime.setAccount({ id: 'bob' });
    mockRuntime.setActiveSessionId('b-session');
  });
}
function makePersistence(client: ReturnType<typeof createInboxQueryClient>) {
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
const cases = [
  {
    name: 'archive',
    useAction: useArchiveMessage,
    key: INBOX_MUTATION_KEYS.archive,
    input: { messageId: 'a', archiveMailboxId: 'archive' },
  },
  {
    name: 'trash',
    useAction: useDeleteMessage,
    key: INBOX_MUTATION_KEYS.delete,
    input: { messageId: 'a', isInTrash: false, trashMailboxId: 'trash' },
  },
] as const;

describe.each(cases)('$name', ({ useAction, key, input }) => {
  it('does not retry or roll back a late A request after real persister activates B', async () => {
    let release!: (v: ReturnType<typeof response>) => void, begun!: () => void;
    const pending = new Promise<ReturnType<typeof response>>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      begun = resolve;
    });
    const sent: string[] = [];
    globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      sent.push(new Headers(init?.headers).get('authorization') ?? '');
      if (sent.length === 1) {
        begun();
        return pending;
      }
      return {
        ...response({ error: 'forbidden' }),
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      };
    }) as never;
    const client = createInboxQueryClient();
    client.setDefaultOptions({
      ...client.getDefaultOptions(),
      mutations: { ...client.getDefaultOptions().mutations, retryDelay: 0 },
    });
    client.mount();
    const persistence = makePersistence(client);
    persistence.activate('alice');
    await persistence.whenReady();
    useEmailStore.getState()._initApi(mockOxy.http);
    const keyA = emailKeys.message.detail('a', 'alice');
    client.setQueryData(
      keyA,
      wireMessage({ _id: 'a', userId: 'alice', subject: 'synthetic-private-A' }),
    );
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, rerender, unmount } = renderHook(() => useAction(), { wrapper });
    const onError = jest.fn(),
      onSuccess = jest.fn(),
      onSettled = jest.fn();
    let op!: Promise<unknown>;
    act(() => {
      op = result.current
        .mutateAsync(input as never, { onError, onSuccess, onSettled })
        .catch((e: unknown) => e);
    });
    await started;
    act(() => {
      switchToBob();
      persistence.activate('bob');
      rerender();
    });
    await persistence.whenReady();
    await act(async () => {
      release(response({ data: wireMessage({ _id: 'a' }) }));
      await op;
    });
    expect(sent).toEqual([`Bearer ${token('alice', 'a-session')}`]);
    expect(client.getQueryData(keyA)).toBeUndefined();
    expect(onError).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onSettled).not.toHaveBeenCalled();
    expect(require('@oxy.so/bloom/toast').toast.error).not.toHaveBeenCalled();
    persistence.detach();
    unmount();
    client.unmount();
    client.clear();
  });

  it('does not run an A Undo retained after the persister activates B', async () => {
    const toast = require('@oxy.so/bloom/toast').toast;
    const sent: string[] = [];
    globalThis.fetch = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
      sent.push(new Headers(init?.headers).get('authorization') ?? '');
      return response({
        data: String(url).includes('/bulk/move')
          ? { matched: 1, modified: 1 }
          : wireMessage({ _id: 'a' }),
      });
    }) as never;
    const client = createInboxQueryClient();
    client.mount();
    const persistence = makePersistence(client);
    persistence.activate('alice');
    await persistence.whenReady();
    useEmailStore.getState()._initApi(mockOxy.http);
    const keyA = emailKeys.message.detail('a', 'alice');
    client.setQueryData(
      keyA,
      wireMessage({ _id: 'a', userId: 'alice', subject: 'synthetic-private-A' }),
    );
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, rerender, unmount } = renderHook(() => useAction(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(input as never);
    });
    const undo = toast.success.mock.calls.at(-1)[1].action.onClick as () => void;
    act(() => {
      switchToBob();
      persistence.activate('bob');
      rerender();
    });
    await persistence.whenReady();
    act(() => undo());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(sent).toEqual([`Bearer ${token('alice', 'a-session')}`]);
    expect(client.getQueryData(keyA)).toBeUndefined();
    expect(toast.error).not.toHaveBeenCalled();
    persistence.detach();
    unmount();
    client.unmount();
    client.clear();
  });

  it('allows Undo after the screen unmounts when the owner is still current', async () => {
    const toast = require('@oxy.so/bloom/toast').toast;
    const sent: string[] = [];
    globalThis.fetch = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
      sent.push(new Headers(init?.headers).get('authorization') ?? '');
      return response({
        data: String(url).includes('/bulk/move')
          ? { matched: 1, modified: 1 }
          : wireMessage({ _id: 'a' }),
      });
    }) as never;
    const client = createInboxQueryClient();
    useEmailStore.getState()._initApi(mockOxy.http);
    const keyA = emailKeys.message.detail('a', 'alice');
    client.setQueryData(keyA, wireMessage({ _id: 'a', userId: 'alice' }));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, unmount } = renderHook(() => useAction(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(input as never);
    });
    const undo = toast.success.mock.calls.at(-1)[1].action.onClick as () => void;
    unmount();
    act(() => undo());
    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent).toEqual([
      `Bearer ${token('alice', 'a-session')}`,
      `Bearer ${token('alice', 'a-session')}`,
    ]);
    client.clear();
  });

  it('suppresses a late Undo failure and invalidation after changing accounts', async () => {
    const toast = require('@oxy.so/bloom/toast').toast;
    let finishUndo!: (value: ReturnType<typeof response>) => void, undoBegun!: () => void;
    const undoResponse = new Promise<ReturnType<typeof response>>((resolve) => {
      finishUndo = resolve;
    });
    const started = new Promise<void>((resolve) => {
      undoBegun = resolve;
    });
    globalThis.fetch = jest.fn(async (url: string | URL | Request) => {
      if (String(url).includes('/bulk/move')) {
        undoBegun();
        return undoResponse;
      }
      return response({ data: wireMessage({ _id: 'a' }) });
    }) as never;
    const client = createInboxQueryClient();
    client.mount();
    const persistence = makePersistence(client);
    persistence.activate('alice');
    await persistence.whenReady();
    useEmailStore.getState()._initApi(mockOxy.http);
    const keyA = emailKeys.message.detail('a', 'alice');
    client.setQueryData(keyA, wireMessage({ _id: 'a', userId: 'alice' }));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, rerender, unmount } = renderHook(() => useAction(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(input as never);
    });
    const undo = toast.success.mock.calls.at(-1)[1].action.onClick as () => void;
    act(() => undo());
    await started;
    act(() => {
      switchToBob();
      persistence.activate('bob');
      rerender();
    });
    await persistence.whenReady();
    const invalidations = jest.spyOn(client, 'invalidateQueries');
    await act(async () => {
      finishUndo(response({ data: { matched: 1, modified: 1 } }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(toast.error).not.toHaveBeenCalled();
    expect(invalidations).not.toHaveBeenCalled();
    expect(client.getQueryData(keyA)).toBeUndefined();
    persistence.detach();
    unmount();
    client.unmount();
    client.clear();
  });

  it('rejects retained Undo after A to B to A with bearer changes', async () => {
    const toast = require('@oxy.so/bloom/toast').toast;
    const sent: string[] = [];
    globalThis.fetch = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
      sent.push(new Headers(init?.headers).get('authorization') ?? '');
      return response({
        data: String(url).includes('/bulk/move')
          ? { matched: 1, modified: 1 }
          : wireMessage({ _id: 'a' }),
      });
    }) as never;
    const client = createInboxQueryClient();
    useEmailStore.getState()._initApi(mockOxy.http);
    client.setQueryData(
      emailKeys.message.detail('a', 'alice'),
      wireMessage({ _id: 'a', userId: 'alice' }),
    );
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, rerender, unmount } = renderHook(() => useAction(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(input as never);
    });
    const undo = toast.success.mock.calls.at(-1)[1].action.onClick as () => void;
    act(() => {
      switchToBob();
      mockUser = 'alice';
      mockOxy.session.setAccessToken(token('alice', 'a-session'));
      mockRuntime.setAccount({ id: 'alice' });
      mockRuntime.setActiveSessionId('a-session');
      rerender();
      undo();
    });
    expect(sent).toEqual([`Bearer ${token('alice', 'a-session')}`]);
    expect(toast.error).not.toHaveBeenCalled();
    unmount();
    client.clear();
  });

  it('does not send Undo if a synthetic cache listener switches account during restoration', async () => {
    const toast = require('@oxy.so/bloom/toast').toast;
    const fetchSpy = jest.fn(async () => response({ data: wireMessage({ _id: 'a' }) }));
    globalThis.fetch = fetchSpy as never;
    const client = createInboxQueryClient(),
      persistence = makePersistence(client);
    persistence.activate('alice');
    await persistence.whenReady();
    useEmailStore.getState()._initApi(mockOxy.http);
    const keyA = emailKeys.message.detail('a', 'alice'),
      listA = emailKeys.messages.list({ userId: 'alice' });
    const message = wireMessage({ _id: 'a', userId: 'alice' });
    client.setQueryData(keyA, message);
    client.setQueryData(listA, {
      pages: [{ data: [message], pagination: { total: 1, offset: 0, limit: 10, hasMore: false } }],
      pageParams: [null],
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, unmount } = renderHook(() => useAction(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(input as never);
    });
    const undo = toast.success.mock.calls.at(-1)[1].action.onClick as () => void;
    let switched = false;
    const off = client.getQueryCache().subscribe((event) => {
      if (!switched && event.type === 'updated') {
        switched = true;
        switchToBob();
        persistence.activate('bob');
      }
    });
    act(() => undo());
    off();
    await persistence.whenReady();
    expect(switched).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    persistence.detach();
    unmount();
    client.clear();
  });

  it('retains same-owner offline retry and flat legacy variables', async () => {
    onlineManager.setOnline(false);
    const sent: string[] = [];
    globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      sent.push(new Headers(init?.headers).get('authorization') ?? '');
      if (sent.length === 1) throw new Error('synthetic offline');
      return response({ data: wireMessage({ _id: 'a' }) });
    }) as never;
    const client = createInboxQueryClient();
    client.setDefaultOptions({
      ...client.getDefaultOptions(),
      mutations: { ...client.getDefaultOptions().mutations, retryDelay: 0 },
    });
    client.mount();
    useEmailStore.getState()._initApi(mockOxy.http);
    const keyA = emailKeys.message.detail('a', 'alice');
    client.setQueryData(keyA, wireMessage({ _id: 'a', userId: 'alice' }));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, unmount } = renderHook(() => useAction(), { wrapper });
    let operation!: Promise<unknown>;
    act(() => {
      operation = result.current.mutateAsync(input as never).catch((e: unknown) => e);
    });
    await waitFor(() =>
      expect(client.getMutationCache().find({ mutationKey: key })?.state.isPaused).toBe(true),
    );
    const state = dehydrate(client, { shouldDehydrateMutation: () => true });
    expect(state.mutations[0].state.variables).toEqual(input);
    expect(JSON.stringify(state)).not.toContain(token('alice', 'a-session'));
    let outcome: unknown;
    await act(async () => {
      onlineManager.setOnline(true);
      outcome = await operation;
    });
    expect(outcome).not.toBeInstanceOf(Error);
    expect(sent).toEqual([
      `Bearer ${token('alice', 'a-session')}`,
      `Bearer ${token('alice', 'a-session')}`,
    ]);
    unmount();
    client.unmount();
    client.clear();
  });

  it('does not optimistically edit or send after owner changes during cancellation', async () => {
    let unblock!: () => void;
    const blocked = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    const client = createInboxQueryClient();
    jest.spyOn(client, 'cancelQueries').mockImplementation(() => blocked);
    const fetchSpy = jest.fn();
    globalThis.fetch = fetchSpy as never;
    useEmailStore.getState()._initApi(mockOxy.http);
    const keyA = emailKeys.message.detail('a', 'alice');
    client.setQueryData(keyA, wireMessage({ _id: 'a', userId: 'alice' }));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, rerender, unmount } = renderHook(() => useAction(), { wrapper });
    let operation!: Promise<unknown>;
    act(() => {
      operation = result.current.mutateAsync(input as never).catch((e: unknown) => e);
    });
    await waitFor(() => expect(client.cancelQueries).toHaveBeenCalled());
    act(() => {
      switchToBob();
      rerender();
    });
    await act(async () => {
      unblock();
      await operation;
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(require('@oxy.so/bloom/toast').toast.error).not.toHaveBeenCalled();
    unmount();
    client.clear();
  });

  it('restores the snapshot and reports an ordinary failure for the same owner', async () => {
    const toast = require('@oxy.so/bloom/toast').toast;
    globalThis.fetch = jest.fn(async () => ({
      ...response({ error: 'forbidden' }),
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    })) as never;
    const client = createInboxQueryClient();
    client.setMutationDefaults(key, { ...client.getMutationDefaults(key), retry: 0 });
    useEmailStore.getState()._initApi(mockOxy.http);
    const listKey = emailKeys.messages.list({ userId: 'alice' });
    const row = wireMessage({ _id: 'a', userId: 'alice' });
    client.setQueryData(listKey, {
      pages: [{ data: [row], pagination: { total: 1, offset: 0, limit: 10, hasMore: false } }],
      pageParams: [null],
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, unmount } = renderHook(() => useAction(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(input as never).catch(() => {});
    });
    expect(
      (client.getQueryData(listKey) as { pages: { data: unknown[] }[] }).pages[0].data,
    ).toEqual([row]);
    expect(toast.error).toHaveBeenCalledWith(
      `ui.mutations.${key === INBOX_MUTATION_KEYS.archive ? 'archiveFailed' : 'deleteFailed'}`,
    );
    unmount();
    client.clear();
  });

  it('informs the current account when an action cannot start', async () => {
    const toast = require('@oxy.so/bloom/toast').toast;
    const client = createInboxQueryClient();
    const fetchSpy = jest.fn(async () => response({ data: wireMessage({ _id: 'a' }) }));
    globalThis.fetch = fetchSpy as never;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, rerender, unmount } = renderHook(() => useAction(), { wrapper });
    act(() => result.current.mutate(input as never));
    expect(toast.error).toHaveBeenCalledWith('ui.mutations.messageSessionUnavailable');
    expect(fetchSpy).not.toHaveBeenCalled();
    act(() => {
      useEmailStore.getState()._initApi(mockOxy.http);
      rerender();
    });
    await act(async () => {
      await result.current.mutateAsync(input as never);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    unmount();
    client.clear();
  });
});

it('prevents a permanent delete retry after the account switches', async () => {
  let release!: (v: ReturnType<typeof response>) => void, begun!: () => void;
  const pending = new Promise<ReturnType<typeof response>>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    begun = resolve;
  });
  const sent: string[] = [];
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    sent.push(`${init?.method}:${new Headers(init?.headers).get('authorization') ?? ''}`);
    if (sent.length === 1) {
      begun();
      return pending;
    }
    return { ...response({ error: 'forbidden' }), ok: false, status: 403, statusText: 'Forbidden' };
  }) as never;
  const client = createInboxQueryClient();
  client.setDefaultOptions({
    ...client.getDefaultOptions(),
    mutations: { ...client.getDefaultOptions().mutations, retryDelay: 0 },
  });
  client.mount();
  const persistence = makePersistence(client);
  persistence.activate('alice');
  await persistence.whenReady();
  useEmailStore.getState()._initApi(mockOxy.http);
  const keyA = emailKeys.message.detail('a', 'alice');
  client.setQueryData(keyA, wireMessage({ _id: 'a', userId: 'alice' }));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, rerender, unmount } = renderHook(() => useDeleteMessage(), { wrapper });
  let operation!: Promise<unknown>;
  act(() => {
    operation = result.current
      .mutateAsync({ messageId: 'a', isInTrash: true })
      .catch((e: unknown) => e);
  });
  await started;
  act(() => {
    switchToBob();
    persistence.activate('bob');
    rerender();
  });
  await persistence.whenReady();
  await act(async () => {
    release(response({ data: null }));
    await operation;
  });
  expect(sent).toEqual([`DELETE:Bearer ${token('alice', 'a-session')}`]);
  expect(client.getQueryData(keyA)).toBeUndefined();
  expect(require('@oxy.so/bloom/toast').toast.error).not.toHaveBeenCalled();
  persistence.detach();
  unmount();
  client.unmount();
  client.clear();
});
