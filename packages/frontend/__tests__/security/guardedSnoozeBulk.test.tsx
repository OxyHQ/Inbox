import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { dehydrate, onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { OxyServices } from '@oxy.so/core';
import { useEmailStore } from '@/hooks/useEmail';
import { createInboxQueryClient, INBOX_ACCOUNT_QUERIES } from '@/hooks/queries/queryClient';
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
import {
  useSnoozeMessage,
  useBulkDeleteMessages,
  useUnsnoozeMessage,
  useBulkMoveMessages,
  useBulkUpdateFlags,
} from '@/hooks/mutations/useMessageMutations';

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
const ids = ['one', 'two', 'three', 'four', 'five'];
const cases = [
  {
    name: 'snooze',
    useAction: useSnoozeMessage,
    input: { messageIds: ids, until: '2030-01-01T00:00:00.000Z' },
  },
  {
    name: 'permanent delete',
    useAction: useBulkDeleteMessages,
    input: { toTrash: [], permanent: ids },
  },
] as const;

describe.each(cases)('$name', ({ useAction, input }) => {
  it('does not start a fifth A operation under bearer B after the account switch', async () => {
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
      if (sent.length === 4) begun();
      if (sent.length <= 4) return pending;
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
      mutations: { ...client.getDefaultOptions().mutations, retry: 0 },
    });
    client.mount();
    const persistence = makePersistence(client);
    persistence.activate('alice');
    await persistence.whenReady();
    useEmailStore.getState()._initApi(mockOxy.http);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, rerender, unmount } = renderHook(() => useAction(), { wrapper });
    let op!: Promise<unknown>;
    act(() => {
      op = result.current.mutateAsync(input as never).catch((e: unknown) => e);
    });
    await started;
    act(() => {
      switchToBob();
      persistence.activate('bob');
      rerender();
    });
    await persistence.whenReady();
    await act(async () => {
      release(response({ data: wireMessage() }));
      await op;
    });
    expect(sent).toEqual(Array(4).fill(`Bearer ${token('alice', 'a-session')}`));
    persistence.detach();
    unmount();
    client.unmount();
    client.clear();
  });
});

const batchIds = Array.from({ length: 101 }, (_, i) => `id-${i}`);
const batchCases = [
  {
    name: 'bulk move',
    useAction: useBulkMoveMessages,
    input: { messageIds: batchIds, mailboxId: 'archive' },
  },
  {
    name: 'bulk flags',
    useAction: useBulkUpdateFlags,
    input: { messageIds: batchIds, flags: { seen: true } },
  },
  {
    name: 'bulk trash',
    useAction: useBulkDeleteMessages,
    input: { toTrash: batchIds, permanent: [], trashMailboxId: 'trash' },
  },
] as const;
describe.each(batchCases)('$name', ({ useAction, input }) => {
  it('does not send another batch if a synthetic HTTP completion callback switches owner', async () => {
    const sent: string[] = [];
    globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      sent.push(new Headers(init?.headers).get('authorization') ?? '');
      if (sent.length === 1) return response({ data: { matched: 100, modified: 100 } });
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
    const post = mockOxy.http.post.bind(mockOxy.http);
    let switched = false;
    jest.spyOn(mockOxy.http, 'post').mockImplementation(async (...args) => {
      const value = await post(...args);
      if (!switched) {
        switched = true;
        switchToBob();
        persistence.activate('bob');
      }
      return value;
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, unmount } = renderHook(() => useAction(), { wrapper });
    let op!: Promise<unknown>;
    act(() => {
      op = result.current.mutateAsync(input as never).catch((e: unknown) => e);
    });
    await act(async () => {
      await op;
    });
    await persistence.whenReady();
    expect(switched).toBe(true);
    expect(sent).toEqual([`Bearer ${token('alice', 'a-session')}`]);
    persistence.detach();
    unmount();
    client.unmount();
    client.clear();
  });
});

it('finishes all snoozes and Undo on the same account', async () => {
  const toast = require('@oxy.so/bloom/toast').toast;
  const sent: string[] = [];
  globalThis.fetch = jest.fn(async (url: string | URL | Request) => {
    sent.push(String(url));
    return response({ data: wireMessage() });
  }) as never;
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  const list = emailKeys.messages.list({ userId: 'alice' });
  const rows = ids.map((id) => wireMessage({ _id: id, userId: 'alice' }));
  client.setQueryData(list, {
    pages: [{ data: rows, pagination: { total: 5, offset: 0, limit: 10, hasMore: false } }],
    pageParams: [null],
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(() => useSnoozeMessage(), { wrapper });
  await act(async () => {
    await result.current.mutateAsync({ messageIds: ids, until: '2030-01-01T00:00:00.000Z' });
  });
  expect(sent.filter((x) => x.endsWith('/snooze'))).toHaveLength(5);
  const undo = toast.success.mock.calls.at(-1)[1].action.onClick as () => void;
  act(() => undo());
  await waitFor(() => expect(sent.filter((x) => x.endsWith('/unsnooze'))).toHaveLength(5));
  unmount();
  client.clear();
});

it('does not continue a snooze Undo under B after four A requests settle', async () => {
  const toast = require('@oxy.so/bloom/toast').toast;
  let release!: (v: ReturnType<typeof response>) => void, begun!: () => void;
  const pending = new Promise<ReturnType<typeof response>>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    begun = resolve;
  });
  const sent: string[] = [];
  globalThis.fetch = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).endsWith('/unsnooze')) {
      sent.push(new Headers(init?.headers).get('authorization') ?? '');
      if (sent.length === 4) begun();
      if (sent.length <= 4) return pending;
      return {
        ...response({ error: 'forbidden' }),
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      };
    }
    return response({ data: wireMessage() });
  }) as never;
  const client = createInboxQueryClient(),
    persistence = makePersistence(client);
  persistence.activate('alice');
  await persistence.whenReady();
  useEmailStore.getState()._initApi(mockOxy.http);
  const list = emailKeys.messages.list({ userId: 'alice' });
  const rows = ids.map((id) => wireMessage({ _id: id, userId: 'alice' }));
  client.setQueryData(list, {
    pages: [{ data: rows, pagination: { total: 5, offset: 0, limit: 10, hasMore: false } }],
    pageParams: [null],
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, rerender, unmount } = renderHook(() => useSnoozeMessage(), { wrapper });
  await act(async () => {
    await result.current.mutateAsync({ messageIds: ids, until: '2030-01-01T00:00:00.000Z' });
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
  await act(async () => {
    release(response({ data: wireMessage() }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(sent).toEqual(Array(4).fill(`Bearer ${token('alice', 'a-session')}`));
  expect(toast.error).not.toHaveBeenCalled();
  persistence.detach();
  unmount();
  client.clear();
});

it('warns of possible partial completion for a same-owner snooze failure', async () => {
  const toast = require('@oxy.so/bloom/toast').toast;
  const successes: string[] = [];
  globalThis.fetch = jest.fn(async (url: string | URL | Request) => {
    const target = String(url);
    if (target.includes('/five/'))
      return {
        ...response({ error: 'forbidden' }),
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      };
    successes.push(target);
    return response({ data: wireMessage() });
  }) as never;
  const client = createInboxQueryClient();
  client.setDefaultOptions({
    ...client.getDefaultOptions(),
    mutations: { ...client.getDefaultOptions().mutations, retryDelay: 0 },
  });
  useEmailStore.getState()._initApi(mockOxy.http);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(() => useSnoozeMessage(), { wrapper });
  await act(async () => {
    await result.current
      .mutateAsync({ messageIds: ids, until: '2030-01-01T00:00:00.000Z' })
      .catch(() => {});
  });
  expect(successes.length).toBeGreaterThanOrEqual(4);
  expect(toast.error).toHaveBeenCalledWith('ui.mutations.partialMessagesFailed');
  unmount();
  client.clear();
});

it('does not show unavailable feedback for quiet bulk read but reports a manual action', async () => {
  const toast = require('@oxy.so/bloom/toast').toast;
  const client = createInboxQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(() => useBulkUpdateFlags(), { wrapper });
  await act(async () => {
    await result.current
      .mutateAsync({ messageIds: ids, flags: { seen: true }, quiet: true })
      .catch(() => {});
  });
  expect(toast.error).not.toHaveBeenCalled();
  await act(async () => {
    await result.current.mutateAsync({ messageIds: ids, flags: { seen: true } }).catch(() => {});
  });
  expect(toast.error).toHaveBeenCalledWith('ui.mutations.messageSessionUnavailable');
  unmount();
  client.clear();
});

it('preserves a paused snooze in flat legacy variables for same-owner reconnect', async () => {
  onlineManager.setOnline(false);
  let calls = 0;
  globalThis.fetch = jest.fn(async () => {
    calls++;
    if (calls === 1) throw new Error('offline');
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
  const { result, unmount } = renderHook(() => useSnoozeMessage(), { wrapper });
  const input = { messageIds: ['one'], until: '2030-01-01T00:00:00.000Z' };
  let operation!: Promise<unknown>;
  act(() => {
    operation = result.current.mutateAsync(input).catch((error: unknown) => error);
  });
  await waitFor(() => expect(client.getMutationCache().getAll()[0]?.state.isPaused).toBe(true));
  const data = dehydrate(client, { shouldDehydrateMutation: () => true });
  expect(data.mutations[0].state.variables).toEqual(input);
  expect(JSON.stringify(data)).not.toContain(token('alice', 'a-session'));
  let outcome: unknown;
  await act(async () => {
    onlineManager.setOnline(true);
    outcome = await operation;
  });
  expect(outcome).not.toBeInstanceOf(Error);
  expect(calls).toBe(2);
  unmount();
  client.unmount();
  client.clear();
});

it('does not retry a delayed unsnooze after switching to B', async () => {
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
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, rerender, unmount } = renderHook(() => useUnsnoozeMessage(), { wrapper });
  let op!: Promise<unknown>;
  act(() => {
    op = result.current.mutateAsync({ messageId: 'a' }).catch((e: unknown) => e);
  });
  await started;
  act(() => {
    switchToBob();
    persistence.activate('bob');
    rerender();
  });
  await persistence.whenReady();
  await act(async () => {
    release(response({ data: wireMessage() }));
    await op;
  });
  expect(sent).toEqual([`Bearer ${token('alice', 'a-session')}`]);
  expect(require('@oxy.so/bloom/toast').toast.error).not.toHaveBeenCalled();
  persistence.detach();
  unmount();
  client.unmount();
  client.clear();
});

it('checks each bulk Undo batch after a synthetic completion callback switches accounts', async () => {
  const toast = require('@oxy.so/bloom/toast').toast;
  const sent: string[] = [];
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    sent.push(new Headers(init?.headers).get('authorization') ?? '');
    return response({ data: { matched: 100, modified: 100 } });
  }) as never;
  const client = createInboxQueryClient(),
    persistence = makePersistence(client);
  persistence.activate('alice');
  await persistence.whenReady();
  useEmailStore.getState()._initApi(mockOxy.http);
  const list = emailKeys.messages.list({ userId: 'alice' }),
    rows = batchIds.map((id) => wireMessage({ _id: id, userId: 'alice', mailboxId: 'source' }));
  client.setQueryData(list, {
    pages: [{ data: rows, pagination: { total: 101, offset: 0, limit: 101, hasMore: false } }],
    pageParams: [null],
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(() => useBulkMoveMessages(), { wrapper });
  await act(async () => {
    await result.current.mutateAsync({ messageIds: batchIds, mailboxId: 'archive' });
  });
  expect(sent).toHaveLength(2);
  sent.length = 0;
  const post = mockOxy.http.post.bind(mockOxy.http);
  let switched = false,
    done!: () => void;
  const finished = new Promise<void>((resolve) => {
    done = resolve;
  });
  jest.spyOn(mockOxy.http, 'post').mockImplementation(async (...args) => {
    const value = await post(...args);
    if (!switched) {
      switched = true;
      switchToBob();
      persistence.activate('bob');
      done();
    }
    return value;
  });
  const undo = toast.success.mock.calls.at(-1)[1].action.onClick as () => void;
  await act(async () => {
    undo();
    await finished;
    await Promise.resolve();
    await Promise.resolve();
  });
  await persistence.whenReady();
  expect(sent).toEqual([`Bearer ${token('alice', 'a-session')}`]);
  expect(toast.error).not.toHaveBeenCalled();
  persistence.detach();
  unmount();
  client.clear();
});

it('reports that bulk completion can be partial when a later batch fails', async () => {
  const toast = require('@oxy.so/bloom/toast').toast;
  let attempts = 0;
  globalThis.fetch = jest.fn(async () => {
    attempts++;
    if (attempts % 2 === 1) return response({ data: { matched: 100, modified: 100 } });
    return { ...response({ error: 'forbidden' }), ok: false, status: 403, statusText: 'Forbidden' };
  }) as never;
  const client = createInboxQueryClient();
  client.setDefaultOptions({
    ...client.getDefaultOptions(),
    mutations: { ...client.getDefaultOptions().mutations, retryDelay: 0 },
  });
  useEmailStore.getState()._initApi(mockOxy.http);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(() => useBulkMoveMessages(), { wrapper });
  await act(async () => {
    await result.current
      .mutateAsync({ messageIds: batchIds, mailboxId: 'archive' })
      .catch(() => {});
  });
  expect(attempts).toBeGreaterThanOrEqual(2);
  expect(toast.error).toHaveBeenCalledWith('ui.mutations.partialMessagesFailed');
  unmount();
  client.clear();
});

const cancelCases = [
  ...cases,
  ...batchCases,
  { name: 'unsnooze', useAction: useUnsnoozeMessage, input: { messageId: 'one' } },
] as const;
describe.each(cancelCases)('$name cancellation', ({ useAction, input }) => {
  it('does not send after an account change during query cancellation', async () => {
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const client = createInboxQueryClient();
    jest.spyOn(client, 'cancelQueries').mockImplementation(() => blocked);
    const fetchSpy = jest.fn();
    globalThis.fetch = fetchSpy as never;
    useEmailStore.getState()._initApi(mockOxy.http);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, rerender, unmount } = renderHook(() => useAction(), { wrapper });
    let op!: Promise<unknown>;
    act(() => {
      op = result.current.mutateAsync(input as never).catch((e: unknown) => e);
    });
    await waitFor(() => expect(client.cancelQueries).toHaveBeenCalled());
    act(() => {
      switchToBob();
      rerender();
    });
    await act(async () => {
      release();
      await op;
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(require('@oxy.so/bloom/toast').toast.error).not.toHaveBeenCalled();
    unmount();
    client.clear();
  });
});

it('keeps unkeyed bulk delete outside the existing offline and persisted queue', async () => {
  onlineManager.setOnline(false);
  globalThis.fetch = jest.fn(async () => {
    throw new Error('offline');
  }) as never;
  const client = createInboxQueryClient();
  client.mount();
  useEmailStore.getState()._initApi(mockOxy.http);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(() => useBulkDeleteMessages(), { wrapper });
  act(() => result.current.mutate({ toTrash: [], permanent: ['one'] }));
  await waitFor(() => expect(client.getMutationCache().getAll()[0]?.state.status).toBe('error'));
  const mutation = client.getMutationCache().getAll()[0];
  expect(mutation.state.isPaused).toBe(false);
  const { dirname, join } = require('node:path');
  const dir = dirname(require.resolve('@oxy.so/services/package.json'));
  const { accountQueryOwnership } = require(
    join(dir, 'lib/commonjs/ui/hooks/accountQueryPersistence.js'),
  );
  const { snapshot } = require(join(dir, 'lib/commonjs/ui/hooks/persistedQueryCache.js'));
  const ownership = accountQueryOwnership(INBOX_ACCOUNT_QUERIES);
  expect(ownership.ownsMutation(mutation)).toBe(false);
  expect(ownership.persistsMutation(mutation)).toBe(false);
  const raw = snapshot(client, {
    persistsQuery: ownership.persistsQuery,
    shouldDehydrateMutation: (mutation: { options: { mutationKey?: unknown } }) =>
      ownership.persistsMutation(mutation),
  });
  expect(JSON.parse(raw).clientState.mutations).toEqual([]);
  unmount();
  client.unmount();
  client.clear();
});

it('stops queued snoozes after some A requests have succeeded and then B is activated', async () => {
  const itemIds = ['one', 'two', 'three', 'four', 'five', 'six', 'seven'];
  const gates = new Map<string, (value: ReturnType<typeof response>) => void>();
  const started: string[] = [];
  let notify!: () => void;
  const fifthStarted = new Promise<void>((resolve) => {
    notify = resolve;
  });
  globalThis.fetch = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const target = String(url).split('/').at(-2) ?? '';
    const bearer = new Headers(init?.headers).get('authorization') ?? '';
    started.push(`${target}:${bearer}`);
    if (target === 'five') notify();
    return await new Promise<ReturnType<typeof response>>((resolve) => gates.set(target, resolve));
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
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, rerender, unmount } = renderHook(() => useSnoozeMessage(), { wrapper });
  let op!: Promise<unknown>;
  act(() => {
    op = result.current
      .mutateAsync({ messageIds: itemIds, until: '2030-01-01T00:00:00.000Z' })
      .catch((e: unknown) => e);
  });
  await waitFor(() => expect(started).toHaveLength(4));
  await act(async () => {
    gates.get('one')?.(response({ data: wireMessage() }));
    await fifthStarted;
  });
  expect(started).toHaveLength(5);
  act(() => {
    switchToBob();
    persistence.activate('bob');
    rerender();
  });
  await persistence.whenReady();
  await act(async () => {
    for (const [id, resolve] of gates) if (id !== 'one') resolve(response({ data: wireMessage() }));
    await op;
  });
  expect(started).toHaveLength(5);
  expect(started.every((entry) => entry.endsWith(`Bearer ${token('alice', 'a-session')}`))).toBe(
    true,
  );
  expect(require('@oxy.so/bloom/toast').toast.error).not.toHaveBeenCalled();
  persistence.detach();
  unmount();
  client.unmount();
  client.clear();
});

describe.each(batchCases.slice(0, 2))('$name offline replay', ({ useAction, input }) => {
  it('keeps flat variables and resumes batches for the same owner', async () => {
    onlineManager.setOnline(false);
    let calls = 0;
    globalThis.fetch = jest.fn(async () => {
      calls++;
      if (calls === 1) throw new Error('offline');
      return response({ data: { matched: 100, modified: 100 } });
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
    const { result, unmount } = renderHook(() => useAction(), { wrapper });
    let op!: Promise<unknown>;
    act(() => {
      op = result.current.mutateAsync(input as never).catch((e: unknown) => e);
    });
    await waitFor(() => expect(client.getMutationCache().getAll()[0]?.state.isPaused).toBe(true));
    const state = dehydrate(client, { shouldDehydrateMutation: () => true });
    expect(state.mutations[0].state.variables).toEqual(input);
    expect(JSON.stringify(state)).not.toContain(token('alice', 'a-session'));
    let outcome: unknown;
    await act(async () => {
      onlineManager.setOnline(true);
      outcome = await op;
    });
    expect(outcome).not.toBeInstanceOf(Error);
    expect(calls).toBe(3);
    unmount();
    client.unmount();
    client.clear();
  });
});

it('continues queued snoozes through a same-session bearer refresh', async () => {
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
    if (sent.length === 4) begun();
    if (sent.length <= 4) return pending;
    return response({ data: wireMessage() });
  }) as never;
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(() => useSnoozeMessage(), { wrapper });
  const epoch = mockOxy.http.getSessionEpoch();
  let op!: Promise<unknown>;
  act(() => {
    op = result.current
      .mutateAsync({ messageIds: ids, until: '2030-01-01T00:00:00.000Z' })
      .catch((e: unknown) => e);
  });
  await started;
  const freshPayload = Buffer.from(
    JSON.stringify({ userId: 'alice', sessionId: 'a-session', exp: 2000000001, jti: 'refreshed' }),
  ).toString('base64url');
  const fresh = `e30.${freshPayload}.fixture`;
  act(() => mockOxy.session.setAccessToken(fresh));
  expect(mockOxy.http.getSessionEpoch()).toBe(epoch);
  let outcome: unknown;
  await act(async () => {
    release(response({ data: wireMessage() }));
    outcome = await op;
  });
  expect(outcome).not.toBeInstanceOf(Error);
  expect(sent).toHaveLength(5);
  expect(sent[4]).toBe(`Bearer ${fresh}`);
  unmount();
  client.clear();
});

it.each(cancelCases)(
  'rejects a retained $name action after A→B→A bearer changes',
  async ({ useAction, input }) => {
    const client = createInboxQueryClient();
    useEmailStore.getState()._initApi(mockOxy.http);
    const fetchSpy = jest.fn();
    globalThis.fetch = fetchSpy as never;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, rerender, unmount } = renderHook(() => useAction(), { wrapper });
    const retained = result.current.mutateAsync;
    act(() => {
      switchToBob();
      mockUser = 'alice';
      mockOxy.session.setAccessToken(token('alice', 'a-session'));
      mockRuntime.setAccount({ id: 'alice' });
      mockRuntime.setActiveSessionId('a-session');
      rerender();
    });
    await act(async () => {
      await retained(input as never).catch(() => {});
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(require('@oxy.so/bloom/toast').toast.error).not.toHaveBeenCalled();
    unmount();
    client.clear();
  },
);
