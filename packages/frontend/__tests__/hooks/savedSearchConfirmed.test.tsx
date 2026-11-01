import type { ReactNode } from 'react';
import { dirname, join } from 'node:path';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createEmailApi } from '@/services/emailApi';
import { emailKeys } from '@/hooks/queries/queryKeys';

const mockTransport = { get: jest.fn(), post: jest.fn(), delete: jest.fn() };
let mockApi: ReturnType<typeof createEmailApi>;
const mockHttp = {
  getSessionEpoch: () => 0,
  getAccessToken: () => 'synthetic',
  addTokenChangeListener: () => () => {},
};
const mockSession = { userId: 'alice' };
jest.mock('@/hooks/useEmail', () => ({
  useEmailStore: Object.assign(
    (select: (s: { _api: typeof mockApi }) => unknown) => select({ _api: mockApi }),
    { getState: () => ({ _api: mockApi }) },
  ),
}));
jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({ user: { id: 'alice' }, oxyServices: { http: mockHttp, session: mockSession } }),
}));
jest.mock('@oxy.so/bloom/toast', () => ({ toast: { error: jest.fn() } }));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
import {
  useCreateSavedSearch,
  useDeleteSavedSearch,
} from '@/hooks/mutations/useSavedSearchMutations';
import { useSavedSearches } from '@/hooks/queries/useSavedSearches';

const sdk = dirname(require.resolve('@oxy.so/services/package.json'));
const { accountQueryOwnership } = require(
  join(sdk, 'lib/commonjs/ui/hooks/accountQueryPersistence.js'),
);
const { snapshot, hydrateSnapshot } = require(
  join(sdk, 'lib/commonjs/ui/hooks/persistedQueryCache.js'),
);
const row = (id: string) => ({
  id,
  name: `name-${id}`,
  query: id,
  filters: {},
  order: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
beforeEach(() => {
  jest.resetAllMocks();
  mockApi = createEmailApi(mockTransport as never);
  client = new QueryClient({
    defaultOptions: {
      queries: { networkMode: 'offlineFirst', retry: false, gcTime: Infinity },
      mutations: { networkMode: 'offlineFirst', retry: false, gcTime: Infinity },
    },
  });
});
afterEach(() => client.clear());

it('persists only the existing confirmed data while a create is pending', async () => {
  let finish!: (value: unknown) => void;
  mockTransport.post.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  client.setQueryData(emailKeys.savedSearches, [row('confirmed')]);
  const { result } = renderHook(() => useCreateSavedSearch(), { wrapper });
  let pending!: Promise<unknown>;
  act(() => {
    pending = result.current.mutateAsync({ name: 'pending', query: 'pending', filters: {} });
  });
  await waitFor(() => expect(mockTransport.post).toHaveBeenCalledTimes(1));
  const ownership = accountQueryOwnership({ roots: ['saved-searches'] });
  const blob = snapshot(client, {
    persistsQuery: ownership.persistsQuery,
    shouldDehydrateMutation: () => false,
  });
  const restored = new QueryClient();
  expect(
    hydrateSnapshot(restored, blob, 7 * 86400000, { shouldRestoreQuery: ownership.persistsQuery }),
  ).toBe(true);
  expect(restored.getQueryData(emailKeys.savedSearches)).toEqual([row('confirmed')]);
  expect(restored.getMutationCache().getAll()).toHaveLength(0);
  await act(async () => {
    finish(row('created'));
    await pending;
  });
  restored.clear();
});

it('keeps the last confirmed snapshot while a delete response is pending', async () => {
  let finish!: () => void;
  mockTransport.delete.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  client.setQueryData(emailKeys.savedSearches, [row('confirmed')]);
  const { result } = renderHook(() => useDeleteSavedSearch(), { wrapper });
  let pending!: Promise<unknown>;
  act(() => {
    pending = result.current.mutateAsync('confirmed');
  });
  await waitFor(() => expect(mockTransport.delete).toHaveBeenCalledTimes(1));
  // A server may already have committed while its response is still in flight.
  // The prior snapshot remains available offline, but may now be stale.
  const ownership = accountQueryOwnership({ roots: ['saved-searches'] });
  const blob = snapshot(client, {
    persistsQuery: ownership.persistsQuery,
    shouldDehydrateMutation: () => false,
  });
  const restored = new QueryClient();
  expect(
    hydrateSnapshot(restored, blob, 7 * 86400000, { shouldRestoreQuery: ownership.persistsQuery }),
  ).toBe(true);
  expect(restored.getQueryData(emailKeys.savedSearches)).toEqual([row('confirmed')]);
  expect(restored.getMutationCache().getAll()).toHaveLength(0);
  await act(async () => {
    finish();
    await pending;
  });
  restored.clear();
});

it('discards an old initial GET even if a delete succeeds before the first cache value', async () => {
  let finishOld!: (value: unknown) => void;
  let finishDelete!: () => void;
  mockTransport.get
    .mockReturnValueOnce(
      new Promise((resolve) => {
        finishOld = resolve;
      }),
    )
    .mockResolvedValueOnce([row('b')]);
  mockTransport.delete.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finishDelete = resolve;
    }),
  );
  const { result } = renderHook(
    () => ({ query: useSavedSearches(), remove: useDeleteSavedSearch() }),
    { wrapper },
  );
  await waitFor(() => expect(mockTransport.get).toHaveBeenCalledTimes(1));
  let pending!: Promise<unknown>;
  act(() => {
    pending = result.current.remove.mutateAsync('a');
  });
  await waitFor(() => expect(mockTransport.delete).toHaveBeenCalledTimes(1));
  await act(async () => {
    finishDelete();
    await pending;
  });
  expect(mockTransport.get).toHaveBeenCalledTimes(2);
  expect(client.getQueryData(emailKeys.savedSearches)).toEqual([row('b')]);
  await act(async () => {
    finishOld([row('a'), row('b')]);
  });
  expect(client.getQueryData(emailKeys.savedSearches)).toEqual([row('b')]);
});

it('does not let an older refetch replace a newer reconciliation', async () => {
  let finishOld!: (value: unknown) => void;
  let finishA!: () => void;
  let finishB!: () => void;
  mockTransport.get
    .mockResolvedValueOnce([row('a'), row('b')])
    .mockReturnValueOnce(
      new Promise((resolve) => {
        finishOld = resolve;
      }),
    )
    .mockResolvedValueOnce([]);
  mockTransport.delete.mockImplementation(
    (url: string) =>
      new Promise<void>((resolve) => {
        if (url.endsWith('/a')) finishA = resolve;
        else finishB = resolve;
      }),
  );
  const { result } = renderHook(
    () => ({ query: useSavedSearches(), remove: useDeleteSavedSearch() }),
    { wrapper },
  );
  await waitFor(() => expect(result.current.query.data).toEqual([row('a'), row('b')]));
  let a!: Promise<unknown>;
  let b!: Promise<unknown>;
  act(() => {
    a = result.current.remove.mutateAsync('a');
    b = result.current.remove.mutateAsync('b');
  });
  await waitFor(() => expect(mockTransport.delete).toHaveBeenCalledTimes(2));
  await act(async () => {
    finishB();
  });
  await waitFor(() => expect(mockTransport.get).toHaveBeenCalledTimes(2));
  await act(async () => {
    finishA();
    await a;
  });
  await waitFor(() => expect(mockTransport.get).toHaveBeenCalledTimes(3));
  await act(async () => {
    finishOld([row('a')]);
    await b;
  });
  expect(client.getQueryData(emailKeys.savedSearches)).toEqual([]);
});

it.each(['failure-first', 'success-first'] as const)(
  'reconciles concurrent deletes with %s',
  async (order) => {
    let failA!: (reason: Error) => void;
    let finishB!: () => void;
    let server = [row('a'), row('b')];
    mockTransport.get.mockImplementation(async () => server.map((item) => ({ ...item })));
    mockTransport.delete.mockImplementation(
      (url: string) =>
        new Promise<void>((resolve, reject) => {
          if (url.endsWith('/a')) failA = reject;
          else finishB = resolve;
        }),
    );
    const { result } = renderHook(
      () => ({ query: useSavedSearches(), remove: useDeleteSavedSearch() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.query.data).toEqual(server));
    let a!: Promise<unknown>;
    let b!: Promise<unknown>;
    act(() => {
      a = result.current.remove.mutateAsync('a').catch((error: unknown) => error);
      b = result.current.remove.mutateAsync('b');
    });
    await waitFor(() => expect(mockTransport.delete).toHaveBeenCalledTimes(2));
    if (order === 'failure-first')
      await act(async () => {
        failA(new Error('network'));
        await a;
      });
    server = [row('a')];
    await act(async () => {
      finishB();
      await b;
    });
    if (order === 'success-first')
      await act(async () => {
        failA(new Error('network'));
        await a;
      });
    await waitFor(() => expect(client.getQueryData(emailKeys.savedSearches)).toEqual([row('a')]));
  },
);
