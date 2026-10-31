import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { dirname, join } from 'node:path';
import {
  INBOX_ACCOUNT_QUERIES,
  INBOX_MEMORY_ONLY_MUTATION_KEYS,
  INBOX_MUTATION_KEYS,
} from '@/hooks/queries/queryClient';

const mockApiA = { saveDraft: jest.fn(), sendMessage: jest.fn() };
const mockApiB = { saveDraft: jest.fn(), sendMessage: jest.fn() };
let mockCurrentApi: typeof mockApiA | null = mockApiA;
let mockUserId = 'A';
let mockEpoch = 0;
const mockListeners = new Set<() => void>();
const mockHttp = {
  getSessionEpoch: () => mockEpoch,
  getAccessToken: () => 'fixture',
  addTokenChangeListener: (listener: () => void) => {
    mockListeners.add(listener);
    return () => mockListeners.delete(listener);
  },
};

jest.mock('@/hooks/useEmail', () => ({
  useEmailStore: Object.assign(
    (selector: (state: { _api: typeof mockCurrentApi }) => unknown) =>
      selector({ _api: mockCurrentApi }),
    { getState: () => ({ _api: mockCurrentApi }) },
  ),
}));
const mockSession = {
  get userId() {
    return mockUserId;
  },
};
jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({
    oxyServices: { http: mockHttp, session: mockSession },
    user: { id: mockUserId },
  }),
}));
jest.mock('@oxy.so/bloom/toast', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import { useSaveDraft, useSendMessage } from '@/hooks/mutations/useMessageMutations';

const sdk = dirname(require.resolve('@oxy.so/services/package.json'));
const { createAccountQueryPersistence } = require(
  join(sdk, 'lib/commonjs/ui/hooks/accountQueryPersistence.js'),
);
const { attachQueryPersistence } = require(join(sdk, 'lib/commonjs/ui/hooks/queryClient.js'));

function setup() {
  const client = new QueryClient({
    defaultOptions: { mutations: { networkMode: 'offlineFirst', retry: 0 } },
  });
  const scope = createAccountQueryPersistence(client, INBOX_ACCOUNT_QUERIES);
  scope.activate('A');
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, scope, invalidate, wrapper };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCurrentApi = mockApiA;
  mockUserId = 'A';
  mockEpoch = 0;
});

it('suppresses a late draft result and invalidation after switching accounts', async () => {
  let finish!: (value: unknown) => void;
  mockApiA.saveDraft.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const { client, scope, invalidate, wrapper } = setup();
  const { result, rerender } = renderHook(() => useSaveDraft(), { wrapper });
  let pending!: Promise<unknown>;
  act(() => {
    pending = result.current
      .mutateAsync({ subject: 'private A', text: 'draft A' })
      .catch(() => undefined);
  });
  await waitFor(() => expect(mockApiA.saveDraft).toHaveBeenCalled());
  act(() => scope.activate('B'));
  expect(client.getMutationCache().getAll()).toHaveLength(0);
  mockCurrentApi = mockApiB;
  mockUserId = 'B';
  act(() => {
    mockEpoch++;
    for (const listener of mockListeners) listener();
    rerender();
  });
  expect(result.current.isPending).toBe(false);
  expect(result.current.variables).toBeUndefined();
  invalidate.mockClear();
  await act(async () => {
    finish({ _id: 'draft-a' });
    await pending;
  });
  expect(invalidate).not.toHaveBeenCalled();
  client.clear();
});

it('rejects a stale send handler after A to B to A', async () => {
  const { client, wrapper } = setup();
  const { result } = renderHook(() => useSendMessage(), { wrapper });
  const oldSend = result.current.mutateAsync;
  act(() => {
    mockEpoch += 2;
    for (const listener of mockListeners) listener();
  });
  await act(async () => {
    await expect(oldSend({ to: [], subject: 'old', idempotencyKey: 'test' })).rejects.toThrow(
      'Email account changed',
    );
  });
  expect(mockApiA.sendMessage).not.toHaveBeenCalled();
  client.clear();
});

it('still completes and invalidates the draft within its originating session', async () => {
  mockApiA.saveDraft.mockResolvedValueOnce({ _id: 'saved' });
  const { client, invalidate, wrapper } = setup();
  const { result } = renderHook(() => useSaveDraft(), { wrapper });
  await act(async () => {
    await expect(result.current.mutateAsync({ text: 'draft' })).resolves.toEqual({ _id: 'saved' });
  });
  expect(mockApiA.saveDraft).toHaveBeenCalledWith({ text: 'draft' });
  expect(invalidate).toHaveBeenCalled();
  client.clear();
});

it('suppresses per-call callbacks of an in-flight scheduled send after switching accounts', async () => {
  let finish!: (value: unknown) => void;
  mockApiA.sendMessage.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const { client, scope, invalidate, wrapper } = setup();
  const { result, rerender } = renderHook(() => useSendMessage(), { wrapper });
  const onSuccess = jest.fn();
  act(() => {
    result.current.mutate({ to: [], subject: 'private A', idempotencyKey: 'test' }, { onSuccess });
  });
  await waitFor(() => expect(mockApiA.sendMessage).toHaveBeenCalled());
  scope.activate('B');
  mockCurrentApi = mockApiB;
  mockUserId = 'B';
  act(() => {
    mockEpoch++;
    for (const listener of mockListeners) listener();
    rerender();
  });
  invalidate.mockClear();
  await act(async () => {
    finish({ message: 'sent' });
    await Promise.resolve();
  });
  expect(onSuccess).not.toHaveBeenCalled();
  expect(invalidate).not.toHaveBeenCalled();
  client.clear();
});

it('keeps actions stable within a session and replaces them when the owner changes', () => {
  const { client, wrapper } = setup();
  const { result, rerender } = renderHook(() => useSaveDraft(), { wrapper });
  const oldSave = result.current.mutateAsync;
  rerender();
  expect(result.current.mutateAsync).toBe(oldSave);
  act(() => {
    mockEpoch++;
    for (const listener of mockListeners) listener();
  });
  expect(result.current.mutateAsync).not.toBe(oldSave);
  client.clear();
});

it('keeps real draft and send mutations out of both caches without changing the 10 offline queues', async () => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: 0 } } });
  const entries = new Map<string, string>();
  const storage = {
    getItem: async (key: string) => entries.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      entries.set(key, value);
    },
    removeItem: async (key: string) => {
      entries.delete(key);
    },
  };
  // Inbox supplies its own QueryClient and does not attach the shared cache;
  // exercise both SDK persisters here to guard the reusable config boundary.
  const shared = attachQueryPersistence(client, storage, INBOX_ACCOUNT_QUERIES);
  await shared.restored;
  const scope = createAccountQueryPersistence(client, INBOX_ACCOUNT_QUERIES);
  scope.setStorage(storage);
  scope.attach();
  scope.activate('A');
  await scope.whenReady();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  mockApiA.saveDraft.mockResolvedValueOnce({ _id: 'saved' });
  mockApiA.sendMessage.mockResolvedValueOnce({ message: 'sent' });
  const draft = renderHook(() => useSaveDraft(), { wrapper });
  const send = renderHook(() => useSendMessage(), { wrapper });
  await act(async () => {
    await draft.result.current.mutateAsync({ text: 'synthetic-draft-private' });
    await send.result.current.mutateAsync({
      to: [],
      subject: 'synthetic-send-private',
      idempotencyKey: 'test',
    });
  });
  const records = client.getMutationCache().getAll();
  expect(records.map((record) => record.options.mutationKey)).toEqual(
    Object.values(INBOX_MEMORY_ONLY_MUTATION_KEYS),
  );
  for (const [name, key] of Object.entries(INBOX_MUTATION_KEYS)) {
    const mutation = client
      .getMutationCache()
      .build(client, { mutationKey: key, mutationFn: async () => undefined });
    mutation.state = { ...mutation.state, status: 'pending', isPaused: true, variables: { name } };
  }
  const unrelated = client.getMutationCache().build(client, {
    mutationKey: ['other', 'offline'],
    mutationFn: async () => undefined,
  });
  unrelated.state = {
    ...unrelated.state,
    status: 'pending',
    isPaused: true,
    variables: { marker: 'unrelated-offline-work' },
  };
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
  });
  const accountBlob = entries.get('oxy_account_queries:A');
  const sharedBlob = entries.get('oxy_query_cache_v3');
  expect(accountBlob).toBeDefined();
  expect(sharedBlob).toBeDefined();
  expect(sharedBlob).toContain('unrelated-offline-work');
  expect(accountBlob).not.toContain('unrelated-offline-work');
  for (const blob of [accountBlob, sharedBlob]) {
    expect(blob).not.toContain('synthetic-draft-private');
    expect(blob).not.toContain('synthetic-send-private');
  }
  for (const key of Object.values(INBOX_MUTATION_KEYS)) {
    expect(accountBlob).toContain(JSON.stringify(key));
  }
  act(() => scope.activate('B'));
  expect(client.getMutationCache().getAll()).toEqual([unrelated]);
  await act(async () => {
    await scope.whenReady();
    scope.activate('A');
    await scope.whenReady();
  });
  expect(
    client
      .getMutationCache()
      .getAll()
      .map((record) => record.options.mutationKey),
  ).toEqual([['other', 'offline'], ...Object.values(INBOX_MUTATION_KEYS)]);
  draft.unmount();
  send.unmount();
  scope.detach();
  shared.unsubscribe();
  client.clear();
});
