import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { dehydrate, onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { OxyServices } from '@oxy.so/core';
import { createInboxQueryClient, INBOX_ACCOUNT_QUERIES } from '@/hooks/queries/queryClient';
import { useEmailStore } from '@/hooks/useEmail';
import { MessageSchema } from '@/schemas/emailSchemas';
import { wireMessage } from '../fixtures/wire';

let mockOxy: OxyServices;
let mockUser: string | null = 'alice';
let mockRuntime: ReturnType<typeof import('@oxy.so/services/runtime').useOxyRuntime>;
const mockTranslate = (key: string) => key;
const mockToast = Object.assign(jest.fn(), {
  success: jest.fn(),
  error: jest.fn(),
  warning: jest.fn(),
  dismiss: jest.fn(),
});
jest.mock('@oxy.so/services/runtime', () => ({ useOxyRuntime: () => mockRuntime }));
jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({ user: mockUser === null ? null : { id: mockUser }, oxyServices: mockOxy }),
}));
jest.mock('@oxy.so/bloom/toast', () => ({ toast: mockToast }));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: mockTranslate, locale: 'en' }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
}));
import { useComposeSession } from '@/hooks/useComposeSession';
import { useDiscardDraft } from '@/hooks/mutations/useMessageMutations';

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

it.each(['B', 'ABA'] as const)(
  'does not discard an A draft after %s during queued save and composer closure',
  async (transition) => {
    let finishSave!: (value: ReturnType<typeof response>) => void, begun!: () => void;
    const pending = new Promise<ReturnType<typeof response>>((resolve) => {
      finishSave = resolve;
    });
    const started = new Promise<void>((resolve) => {
      begun = resolve;
    });
    const requests: { method: string; url: string; bearer: string }[] = [];
    globalThis.fetch = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const item = {
        method: init?.method ?? 'GET',
        url: String(url),
        bearer: new Headers(init?.headers).get('authorization') ?? '',
      };
      requests.push(item);
      if (item.method === 'POST' && item.url.endsWith('/email/drafts')) {
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
    client.mount();
    const persistence = persistenceFor(client);
    persistence.activate('alice');
    await persistence.whenReady();
    useEmailStore.getState()._initApi(mockOxy.http);
    const draft = MessageSchema.parse(
      wireMessage({
        _id: 'synthetic-draft-A',
        id: 'synthetic-draft-A',
        userId: 'alice',
        flags: {
          seen: true,
          starred: false,
          answered: false,
          forwarded: false,
          draft: true,
          pinned: false,
        },
        text: 'synthetic',
        html: null,
      }),
    );
    const onFinished = jest.fn();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, unmount } = renderHook(
      () =>
        useComposeSession({
          recoveryIdentity: 'draft:synthetic',
          draft,
          awaitingReplyHeaders: false,
          insertSignature: false,
          onFinished,
        }),
      { wrapper },
    );
    await act(async () => {
      for (let i = 0; i < 10; i++) await Promise.resolve();
    });
    act(() => result.current.setSubject('synthetic edited'));
    let save!: Promise<unknown>, discard!: Promise<unknown>;
    await act(async () => {
      save = result.current.saveAndClose();
      await started;
    });
    act(() => {
      discard = result.current.discardDraft();
    });
    expect(onFinished).toHaveBeenCalled();
    unmount();
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
      if (transition === 'ABA') {
        mockUser = 'alice';
        mockOxy.session.setAccessToken(token('alice', 'a-session'));
        mockRuntime.batch(() => {
          mockRuntime.setAccount({ id: 'alice' });
          mockRuntime.setActiveSessionId('a-session');
        });
        useEmailStore.getState().resetAccountScopedState();
        useEmailStore.getState()._initApi(mockOxy.http);
        persistence.activate('alice');
      }
    });
    await persistence.whenReady();
    await act(async () => {
      finishSave(response({ data: wireMessage({ _id: 'synthetic-draft-A' }) }));
      await save;
      await discard;
    });
    expect(requests).toEqual([
      {
        method: 'POST',
        url: expect.stringContaining('/email/drafts'),
        bearer: `Bearer ${token('alice', 'a-session')}`,
      },
    ]);
    expect(mockToast.error).not.toHaveBeenCalled();
    persistence.detach();
    client.unmount();
    client.clear();
  },
);

it.each(['success', 'failure'] as const)(
  'finishes discard on the same account after a queued save %s',
  async (saveResult) => {
    let release!: (value: ReturnType<typeof response>) => void, begun!: () => void;
    const pending = new Promise<ReturnType<typeof response>>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      begun = resolve;
    });
    const requests: { method: string; bearer: string }[] = [];
    globalThis.fetch = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({
        method: init?.method ?? 'GET',
        bearer: new Headers(init?.headers).get('authorization') ?? '',
      });
      if (String(url).endsWith('/email/drafts')) {
        begun();
        return pending;
      }
      return response({ data: null });
    }) as never;
    const client = createInboxQueryClient();
    useEmailStore.getState()._initApi(mockOxy.http);
    const draft = MessageSchema.parse(
      wireMessage({
        _id: 'synthetic-draft-A',
        userId: 'alice',
        flags: {
          seen: true,
          starred: false,
          answered: false,
          forwarded: false,
          draft: true,
          pinned: false,
        },
        text: 'synthetic',
        html: null,
      }),
    );
    const onFinished = jest.fn(),
      wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
    const { result, unmount } = renderHook(
      () =>
        useComposeSession({
          recoveryIdentity: 'draft:synthetic',
          draft,
          awaitingReplyHeaders: false,
          insertSignature: false,
          onFinished,
        }),
      { wrapper },
    );
    await act(async () => {
      for (let i = 0; i < 10; i++) await Promise.resolve();
    });
    act(() => result.current.setSubject('synthetic edited'));
    let save!: Promise<unknown>, discard!: Promise<unknown>;
    await act(async () => {
      save = result.current.saveAndClose();
      await started;
    });
    act(() => {
      discard = result.current.discardDraft();
    });
    expect(onFinished).toHaveBeenCalled();
    unmount();
    await act(async () => {
      release(
        saveResult === 'success'
          ? response({ data: wireMessage({ _id: 'synthetic-draft-A' }) })
          : {
              ...response({ error: 'forbidden' }),
              ok: false,
              status: 403,
              statusText: 'Forbidden',
            },
      );
      await save;
      await discard;
    });
    expect(requests).toEqual([
      { method: 'POST', bearer: `Bearer ${token('alice', 'a-session')}` },
      { method: 'DELETE', bearer: `Bearer ${token('alice', 'a-session')}` },
    ]);
    expect(mockToast.error).not.toHaveBeenCalled();
    client.clear();
  },
);

it('does not publish the late discard error or invalidate B after a sent A request', async () => {
  let release!: (value: ReturnType<typeof response>) => void, begun!: () => void;
  const pending = new Promise<ReturnType<typeof response>>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    begun = resolve;
  });
  const bearers: string[] = [];
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    bearers.push(new Headers(init?.headers).get('authorization') ?? '');
    begun();
    return pending;
  }) as never;
  const client = createInboxQueryClient();
  client.mount();
  const persistence = persistenceFor(client);
  persistence.activate('alice');
  await persistence.whenReady();
  useEmailStore.getState()._initApi(mockOxy.http);
  const draft = MessageSchema.parse(
    wireMessage({
      _id: 'synthetic-draft-A',
      userId: 'alice',
      flags: {
        seen: true,
        starred: false,
        answered: false,
        forwarded: false,
        draft: true,
        pinned: false,
      },
    }),
  );
  const onFinished = jest.fn(),
    wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  const { result, unmount } = renderHook(
    () =>
      useComposeSession({
        recoveryIdentity: 'draft:synthetic',
        draft,
        awaitingReplyHeaders: false,
        insertSignature: false,
        onFinished,
      }),
    { wrapper },
  );
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
  let discard!: Promise<unknown>;
  await act(async () => {
    discard = result.current.discardDraft();
    await started;
  });
  expect(onFinished).toHaveBeenCalled();
  unmount();
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
  });
  await persistence.whenReady();
  const invalidations = jest.spyOn(client, 'invalidateQueries');
  await act(async () => {
    release({
      ...response({ error: 'forbidden' }),
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    });
    await discard;
  });
  expect(bearers).toEqual([`Bearer ${token('alice', 'a-session')}`]);
  expect(mockToast.error).not.toHaveBeenCalled();
  expect(invalidations).not.toHaveBeenCalled();
  persistence.detach();
  client.unmount();
  client.clear();
});

it.each(['unavailable', 'failure'] as const)(
  'reports a same-owner discard %s after the composer closes',
  async (mode) => {
    const requests: string[] = [];
    globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      requests.push(init?.method ?? 'GET');
      return {
        ...response({ error: 'forbidden' }),
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      };
    }) as never;
    const client = createInboxQueryClient();
    if (mode === 'failure') useEmailStore.getState()._initApi(mockOxy.http);
    const draft = MessageSchema.parse(
      wireMessage({
        _id: 'synthetic-draft-A',
        userId: 'alice',
        flags: {
          seen: true,
          starred: false,
          answered: false,
          forwarded: false,
          draft: true,
          pinned: false,
        },
      }),
    );
    const onFinished = jest.fn(),
      wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
    const { result, unmount } = renderHook(
      () =>
        useComposeSession({
          recoveryIdentity: 'draft:synthetic',
          draft,
          awaitingReplyHeaders: false,
          insertSignature: false,
          onFinished,
        }),
      { wrapper },
    );
    await act(async () => {
      for (let i = 0; i < 10; i++) await Promise.resolve();
    });
    let discard!: Promise<unknown>;
    act(() => {
      discard = result.current.discardDraft();
    });
    expect(onFinished).toHaveBeenCalled();
    unmount();
    await act(async () => {
      await discard;
    });
    expect(requests).toEqual(mode === 'failure' ? ['DELETE'] : []);
    if (mode === 'unavailable')
      expect(mockToast.error).toHaveBeenCalledWith('ui.mutations.messageSessionUnavailable');
    else expect(mockToast.error).toHaveBeenCalledTimes(1);
    client.clear();
  },
);

it('does not serialize owner credentials or register the unkeyed discard for replay', async () => {
  let release!: (value: ReturnType<typeof response>) => void, begun!: () => void;
  const pending = new Promise<ReturnType<typeof response>>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    begun = resolve;
  });
  globalThis.fetch = jest.fn(async () => {
    begun();
    return pending;
  }) as never;
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(() => useDiscardDraft(), { wrapper });
  let operation!: Promise<unknown>;
  await act(async () => {
    operation = result.current.mutateAsync('synthetic-draft-A');
    await started;
  });
  const mutation = client.getMutationCache().getAll()[0];
  expect(mutation.options.mutationKey).toBeUndefined();
  const state = dehydrate(client, { shouldDehydrateMutation: () => true });
  expect(state.mutations[0].state.variables).toEqual({ input: 'synthetic-draft-A' });
  expect(JSON.stringify(state)).not.toContain(token('alice', 'a-session'));
  const { dirname, join } = require('node:path');
  const dir = dirname(require.resolve('@oxy.so/services/package.json'));
  const { accountQueryOwnership } = require(
    join(dir, 'lib/commonjs/ui/hooks/accountQueryPersistence.js'),
  );
  const ownership = accountQueryOwnership(INBOX_ACCOUNT_QUERIES);
  expect(ownership.persistsMutation(mutation)).toBe(false);
  expect(ownership.ownsMutation(mutation)).toBe(false);
  await act(async () => {
    release(response({ data: null }));
    await operation;
  });
  unmount();
  client.clear();
});

it('does not add offline retry to discard', async () => {
  onlineManager.setOnline(false);
  const fetchSpy = jest.fn(async () => {
    throw new Error('offline');
  });
  globalThis.fetch = fetchSpy as never;
  const client = createInboxQueryClient();
  client.mount();
  useEmailStore.getState()._initApi(mockOxy.http);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(() => useDiscardDraft(), { wrapper });
  await act(async () => {
    await result.current.mutateAsync('synthetic-draft-A').catch(() => {});
  });
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  expect(client.getMutationCache().getAll()[0].state.isPaused).toBe(false);
  act(() => onlineManager.setOnline(true));
  await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
  unmount();
  client.unmount();
  client.clear();
});

it('reports an unavailable discard when the projected user is not ready', async () => {
  mockUser = null;
  useEmailStore.getState()._initApi(mockOxy.http);
  const fetchSpy = jest.fn();
  globalThis.fetch = fetchSpy as never;
  const client = createInboxQueryClient(),
    onFinished = jest.fn();
  const draft = MessageSchema.parse(
    wireMessage({
      _id: 'synthetic-draft-A',
      userId: 'alice',
      flags: {
        seen: true,
        starred: false,
        answered: false,
        forwarded: false,
        draft: true,
        pinned: false,
      },
    }),
  );
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(
    () =>
      useComposeSession({
        recoveryIdentity: 'draft:synthetic',
        draft,
        awaitingReplyHeaders: false,
        insertSignature: false,
        onFinished,
      }),
    { wrapper },
  );
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
  let discard!: Promise<unknown>;
  act(() => {
    discard = result.current.discardDraft();
  });
  expect(onFinished).toHaveBeenCalled();
  unmount();
  await act(async () => {
    await discard;
  });
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(mockToast.error).toHaveBeenCalledWith('ui.mutations.messageSessionUnavailable');
  client.clear();
});

it('suppresses feedback when the known bearer and projected account disagree', async () => {
  mockOxy.session.setAccessToken(token('bob', 'b-session'));
  useEmailStore.getState()._initApi(mockOxy.http);
  const fetchSpy = jest.fn();
  globalThis.fetch = fetchSpy as never;
  const client = createInboxQueryClient();
  const draft = MessageSchema.parse(
    wireMessage({
      _id: 'synthetic-draft-A',
      userId: 'alice',
      flags: {
        seen: true,
        starred: false,
        answered: false,
        forwarded: false,
        draft: true,
        pinned: false,
      },
    }),
  );
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(
    () =>
      useComposeSession({
        recoveryIdentity: 'draft:synthetic',
        draft,
        awaitingReplyHeaders: false,
        insertSignature: false,
        onFinished: jest.fn(),
      }),
    { wrapper },
  );
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
  let discard!: Promise<unknown>;
  act(() => {
    discard = result.current.discardDraft();
  });
  unmount();
  await act(async () => {
    await discard;
  });
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(mockToast.error).not.toHaveBeenCalled();
  client.clear();
});

it('reports a same-owner discard failure when a null session projection becomes known', async () => {
  mockRuntime.setActiveSessionId(null);
  let release!: (value: ReturnType<typeof response>) => void, begun!: () => void;
  const pending = new Promise<ReturnType<typeof response>>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    begun = resolve;
  });
  globalThis.fetch = jest.fn(async () => {
    begun();
    return pending;
  }) as never;
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  const draft = MessageSchema.parse(
    wireMessage({
      _id: 'synthetic-draft-A',
      userId: 'alice',
      flags: {
        seen: true,
        starred: false,
        answered: false,
        forwarded: false,
        draft: true,
        pinned: false,
      },
    }),
  );
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(
    () =>
      useComposeSession({
        recoveryIdentity: 'draft:synthetic',
        draft,
        awaitingReplyHeaders: false,
        insertSignature: false,
        onFinished: jest.fn(),
      }),
    { wrapper },
  );
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
  let op!: Promise<unknown>;
  await act(async () => {
    op = result.current.discardDraft();
    await started;
  });
  unmount();
  act(() => mockRuntime.setActiveSessionId('a-session'));
  await act(async () => {
    release({
      ...response({ error: 'forbidden' }),
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    });
    await op;
  });
  expect(mockToast.error).toHaveBeenCalledTimes(1);
  client.clear();
});

it.each(['B', 'ABA'] as const)(
  'suppresses error feedback after projection-only %s while the bearer stays unchanged',
  async (transition) => {
    let release!: (value: ReturnType<typeof response>) => void, begun!: () => void;
    const pending = new Promise<ReturnType<typeof response>>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      begun = resolve;
    });
    globalThis.fetch = jest.fn(async () => {
      begun();
      return pending;
    }) as never;
    const client = createInboxQueryClient();
    useEmailStore.getState()._initApi(mockOxy.http);
    const draft = MessageSchema.parse(
      wireMessage({
        _id: 'synthetic-draft-A',
        userId: 'alice',
        flags: {
          seen: true,
          starred: false,
          answered: false,
          forwarded: false,
          draft: true,
          pinned: false,
        },
      }),
    );
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, unmount } = renderHook(
      () =>
        useComposeSession({
          recoveryIdentity: 'draft:synthetic',
          draft,
          awaitingReplyHeaders: false,
          insertSignature: false,
          onFinished: jest.fn(),
        }),
      { wrapper },
    );
    await act(async () => {
      for (let i = 0; i < 10; i++) await Promise.resolve();
    });
    let op!: Promise<unknown>;
    await act(async () => {
      op = result.current.discardDraft();
      await started;
    });
    unmount();
    act(() => {
      mockRuntime.setAccount({ id: 'bob' });
      if (transition === 'ABA') mockRuntime.setAccount({ id: 'alice' });
    });
    await act(async () => {
      release({
        ...response({ error: 'forbidden' }),
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });
      await op;
    });
    expect(mockToast.error).not.toHaveBeenCalled();
    client.clear();
  },
);

it('suppresses feedback when runtime and rendered account disagree', async () => {
  mockRuntime.setAccount({ id: 'bob' });
  useEmailStore.getState()._initApi(mockOxy.http);
  globalThis.fetch = jest.fn(async () => ({
    ...response({ error: 'forbidden' }),
    ok: false,
    status: 403,
    statusText: 'Forbidden',
  })) as never;
  const client = createInboxQueryClient();
  const draft = MessageSchema.parse(
    wireMessage({
      _id: 'synthetic-draft-A',
      userId: 'alice',
      flags: {
        seen: true,
        starred: false,
        answered: false,
        forwarded: false,
        draft: true,
        pinned: false,
      },
    }),
  );
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(
    () =>
      useComposeSession({
        recoveryIdentity: 'draft:synthetic',
        draft,
        awaitingReplyHeaders: false,
        insertSignature: false,
        onFinished: jest.fn(),
      }),
    { wrapper },
  );
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
  let discard!: Promise<unknown>;
  act(() => {
    discard = result.current.discardDraft();
  });
  unmount();
  await act(async () => {
    await discard;
  });
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  expect(mockToast.error).not.toHaveBeenCalled();
  client.clear();
});
