import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { dehydrate, onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { OxyServices } from '@oxy.so/core';
import { useEmailStore } from '@/hooks/useEmail';
import { createInboxQueryClient, INBOX_MUTATION_KEYS } from '@/hooks/queries/queryClient';
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
import { useToggleRead, useTogglePin } from '@/hooks/mutations/useMessageMutations';

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

const cases = [
  { name: 'read', flag: 'seen', key: INBOX_MUTATION_KEYS.toggleRead, useFlag: useToggleRead },
  { name: 'pin', flag: 'pinned', key: INBOX_MUTATION_KEYS.togglePin, useFlag: useTogglePin },
] as const;

describe.each(cases)('$name', ({ flag, key, useFlag }) => {
  it('prevents late retry, rollback and callbacks after the real persister switches A to B', async () => {
    const { dirname, join } = require('node:path');
    const dir = dirname(require.resolve('@oxy.so/services/package.json'));
    const { createAccountQueryPersistence } = require(
      join(dir, 'lib/commonjs/ui/hooks/accountQueryPersistence.js'),
    );
    const { INBOX_ACCOUNT_QUERIES } = require('@/hooks/queries/queryClient');
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
    let release!: (v: ReturnType<typeof response>) => void;
    let begun!: () => void;
    const pending = new Promise<ReturnType<typeof response>>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      begun = resolve;
    });
    const put = jest.spyOn(mockOxy.http, 'put');
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
    const persistence = createAccountQueryPersistence(client, INBOX_ACCOUNT_QUERIES);
    persistence.setStorage(storage);
    persistence.attach();
    persistence.activate('alice');
    await persistence.whenReady();
    useEmailStore.getState()._initApi(mockOxy.http);
    const oldKey = emailKeys.message.detail('a', 'alice');
    client.setQueryData(
      oldKey,
      wireMessage({ _id: 'a', userId: 'alice', subject: 'synthetic-private-A' }),
    );
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, rerender, unmount } = renderHook(() => useFlag(), { wrapper });
    const success = jest.fn(),
      error = jest.fn(),
      settled = jest.fn();
    let operation!: Promise<unknown>;
    act(() => {
      operation = result.current
        .mutateAsync({ messageId: 'a', [flag]: true } as never, {
          onSuccess: success,
          onError: error,
          onSettled: settled,
        })
        .catch((e: unknown) => e);
    });
    await started;
    expect((client.getQueryData(oldKey) as ReturnType<typeof wireMessage>).flags[flag]).toBe(true);
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
    await act(async () => {
      release(response({ data: wireMessage() }));
      await operation;
    });
    expect(put).toHaveBeenCalledTimes(1);
    expect(sent).toEqual([`Bearer ${token('alice', 'a-session')}`]);
    expect(client.getQueryData(oldKey)).toBeUndefined();
    expect(success).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(settled).not.toHaveBeenCalled();
    expect(require('@oxy.so/bloom/toast').toast.error).not.toHaveBeenCalled();
    persistence.detach();
    unmount();
    client.unmount();
    client.clear();
  });

  it('preserves optimistic state and resumes offline for the same owner without changing variables', async () => {
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
    const oldKey = emailKeys.message.detail('a', 'alice');
    client.setQueryData(oldKey, wireMessage({ _id: 'a', userId: 'alice' }));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, unmount } = renderHook(() => useFlag(), { wrapper });
    let operation!: Promise<unknown>;
    act(() => {
      operation = result.current
        .mutateAsync({ messageId: 'a', [flag]: true } as never, undefined, { quiet: true })
        .catch((e: unknown) => e);
    });
    await waitFor(() =>
      expect(client.getMutationCache().find({ mutationKey: key })?.state.isPaused).toBe(true),
    );
    expect((client.getQueryData(oldKey) as ReturnType<typeof wireMessage>).flags[flag]).toBe(true);
    const state = dehydrate(client, { shouldDehydrateMutation: () => true });
    expect(state.mutations[0].state.variables).toEqual({ messageId: 'a', [flag]: true });
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

  it('reports unavailability for current account and allows retry when the API becomes ready', async () => {
    const { toast } = require('@oxy.so/bloom/toast');
    const client = createInboxQueryClient();
    const fetchSpy = jest.fn(async () => response({ data: wireMessage({ _id: 'a' }) }));
    globalThis.fetch = fetchSpy as never;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, rerender, unmount } = renderHook(() => useFlag(), { wrapper });
    act(() => result.current.mutate({ messageId: 'a', [flag]: true } as never));
    expect(toast.error).toHaveBeenCalledWith('ui.mutations.messageSessionUnavailable');
    expect(fetchSpy).not.toHaveBeenCalled();
    act(() => {
      useEmailStore.getState()._initApi(mockOxy.http);
      rerender();
    });
    await act(async () => {
      await result.current.mutateAsync({ messageId: 'a', [flag]: true } as never);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    unmount();
    client.clear();
  });

  it('does not publish optimistic state or send after account change during cancellation', async () => {
    let finish!: () => void;
    const blocked = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const client = createInboxQueryClient();
    jest.spyOn(client, 'cancelQueries').mockImplementation(() => blocked);
    useEmailStore.getState()._initApi(mockOxy.http);
    const keyA = emailKeys.message.detail('a', 'alice');
    client.setQueryData(keyA, wireMessage({ _id: 'a', userId: 'alice' }));
    const fetchSpy = jest.fn();
    globalThis.fetch = fetchSpy as never;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, rerender, unmount } = renderHook(() => useFlag(), { wrapper });
    let operation!: Promise<unknown>;
    act(() => {
      operation = result.current
        .mutateAsync({ messageId: 'a', [flag]: true } as never)
        .catch((e: unknown) => e);
    });
    await waitFor(() => expect(client.cancelQueries).toHaveBeenCalled());
    act(() => {
      mockUser = 'bob';
      mockOxy.session.setAccessToken(token('bob', 'b-session'));
      mockRuntime.setAccount({ id: 'bob' });
      rerender();
    });
    await act(async () => {
      finish();
      await operation;
    });
    expect((client.getQueryData(keyA) as ReturnType<typeof wireMessage>).flags[flag]).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(require('@oxy.so/bloom/toast').toast.error).not.toHaveBeenCalled();
    unmount();
    client.clear();
  });

  it('rejects an old action after A to B to A with changed bearer epoch', async () => {
    useEmailStore.getState()._initApi(mockOxy.http);
    const client = createInboxQueryClient();
    const fetchSpy = jest.fn();
    globalThis.fetch = fetchSpy as never;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, rerender, unmount } = renderHook(() => useFlag(), { wrapper });
    const retained = result.current.mutateAsync;
    act(() => {
      mockUser = 'bob';
      mockOxy.session.setAccessToken(token('bob', 'b-session'));
      mockRuntime.setAccount({ id: 'bob' });
      mockUser = 'alice';
      mockOxy.session.setAccessToken(token('alice', 'a-session'));
      mockRuntime.setAccount({ id: 'alice' });
      rerender();
    });
    await act(async () => {
      await retained({ messageId: 'a', [flag]: true } as never).catch(() => {});
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(require('@oxy.so/bloom/toast').toast.error).not.toHaveBeenCalled();
    unmount();
    client.clear();
  });

  it('rolls back and reports a real current-owner failure', async () => {
    useEmailStore.getState()._initApi(mockOxy.http);
    const client = createInboxQueryClient();
    client.setMutationDefaults(key, { ...client.getMutationDefaults(key), retry: 0 });
    const keyA = emailKeys.message.detail('a', 'alice');
    client.setQueryData(keyA, wireMessage({ _id: 'a', userId: 'alice' }));
    globalThis.fetch = jest.fn(async () => ({
      ...response({ error: 'forbidden' }),
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    })) as never;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, unmount } = renderHook(() => useFlag(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ messageId: 'a', [flag]: true } as never).catch(() => {});
    });
    expect((client.getQueryData(keyA) as ReturnType<typeof wireMessage>).flags[flag]).toBe(false);
    expect(require('@oxy.so/bloom/toast').toast.error).toHaveBeenCalledWith(
      `ui.mutations.${flag === 'seen' ? 'read' : 'pin'}Failed`,
    );
    unmount();
    client.clear();
  });
});

it('optimistically decrements the current unread badge when marking read', async () => {
  useEmailStore.getState()._initApi(mockOxy.http);
  const client = createInboxQueryClient();
  const messageKey = emailKeys.message.detail('a', 'alice');
  const mailboxKey = emailKeys.mailboxes.list('alice');
  client.setQueryData(messageKey, wireMessage({ _id: 'a', userId: 'alice' }));
  client.setQueryData(mailboxKey, [{ _id: 'inbox-1', unseenMessages: 2 }]);
  let release!: (value: unknown) => void;
  const responseInFlight = new Promise((resolve) => {
    release = resolve;
  });
  jest.spyOn(mockOxy.http, 'put').mockImplementation(async () => await responseInFlight);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(() => useToggleRead(), { wrapper });
  let operation!: Promise<unknown>;
  act(() => {
    operation = result.current.mutateAsync({ messageId: 'a', seen: true });
  });
  await waitFor(() =>
    expect(client.getQueryData(mailboxKey)).toEqual([{ _id: 'inbox-1', unseenMessages: 1 }]),
  );
  expect((client.getQueryData(messageKey) as ReturnType<typeof wireMessage>).flags.seen).toBe(true);
  await act(async () => {
    release(wireMessage({ _id: 'a' }));
    await operation;
  });
  unmount();
  client.clear();
});
