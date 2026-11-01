import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { emailKeys } from '@/hooks/queries/queryKeys';
import type { SavedEmailSearch } from '@/services/emailApi';

const mockApiA = { createSavedSearch: jest.fn(), deleteSavedSearch: jest.fn() };
const mockApiB = { createSavedSearch: jest.fn(), deleteSavedSearch: jest.fn() };
let mockCurrentApi: typeof mockApiA | null = mockApiA;
let mockEpoch = 0;
let mockProjectedSubject = 'alice';
let mockBearerSubject: string | null = 'alice';
let mockToken: string | null = 'token';
const mockSession = {
  get userId() {
    return mockBearerSubject;
  },
};
const mockListeners = new Set<() => void>();
const mockHttp = {
  getSessionEpoch: () => mockEpoch,
  getAccessToken: () => mockToken,
  addTokenChangeListener: (listener: () => void) => {
    mockListeners.add(listener);
    return () => mockListeners.delete(listener);
  },
};
const mockToast = jest.fn();

jest.mock('@/hooks/useEmail', () => ({
  useEmailStore: Object.assign(
    (selector: (state: { _api: typeof mockCurrentApi }) => unknown) =>
      selector({ _api: mockCurrentApi }),
    { getState: () => ({ _api: mockCurrentApi }) },
  ),
}));
jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({
    user: { id: mockProjectedSubject },
    oxyServices: { http: mockHttp, session: mockSession },
  }),
}));
jest.mock('@oxy.so/bloom/toast', () => ({
  toast: { error: (...args: unknown[]) => mockToast(...args) },
}));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import {
  useCreateSavedSearch,
  useDeleteSavedSearch,
} from '@/hooks/mutations/useSavedSearchMutations';

const search = (name: string) => ({ id: 'same-id', name }) as SavedEmailSearch;
const input = { name: 'new', query: 'private query', filters: {} };
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}
function switchToB(rerender: () => void) {
  mockCurrentApi = mockApiB;
  mockProjectedSubject = 'bob';
  mockBearerSubject = 'bob';
  act(() => {
    mockEpoch++;
    for (const listener of mockListeners) listener();
    rerender();
  });
}
beforeEach(() => {
  jest.clearAllMocks();
  mockCurrentApi = mockApiA;
  mockEpoch = 0;
  mockProjectedSubject = 'alice';
  mockBearerSubject = 'alice';
  mockToken = 'token';
});

it.each(['create', 'delete'] as const)(
  'does not roll an old %s failure into the new account or invalidate it',
  async (kind) => {
    let reject!: (error: Error) => void;
    const method = kind === 'create' ? mockApiA.createSavedSearch : mockApiA.deleteSavedSearch;
    method.mockReturnValueOnce(
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
    );
    const { client, wrapper } = setup();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    client.setQueryData(emailKeys.savedSearches, [search('A private')]);
    const { result, rerender } = renderHook(
      () => ({ create: useCreateSavedSearch(), remove: useDeleteSavedSearch() }),
      { wrapper },
    );
    let pending!: Promise<unknown>;
    act(() => {
      pending = (
        kind === 'create'
          ? result.current.create.mutateAsync(input)
          : result.current.remove.mutateAsync('same-id')
      ).catch((error) => error);
    });
    await waitFor(() => expect(method).toHaveBeenCalled());
    const record = client.getMutationCache().getAll()[0];
    expect(record.state.context).toBeUndefined();
    switchToB(rerender);
    client.removeQueries({ queryKey: emailKeys.savedSearches });
    client.setQueryData(emailKeys.savedSearches, [search('B private')]);
    invalidate.mockClear();
    await act(async () => {
      reject(new Error('old failure'));
      expect(await pending).toEqual(expect.objectContaining({ message: 'Email account changed' }));
    });
    expect(client.getQueryData(emailKeys.savedSearches)).toEqual([search('B private')]);
    expect(invalidate).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
    client.clear();
  },
);

it.each(['create', 'delete'] as const)(
  'suppresses old %s success, callback and invalidation after switching',
  async (kind) => {
    let resolve!: (value: unknown) => void;
    const method = kind === 'create' ? mockApiA.createSavedSearch : mockApiA.deleteSavedSearch;
    method.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { client, wrapper } = setup();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const onSuccess = jest.fn();
    const { result, rerender } = renderHook(
      () => ({ create: useCreateSavedSearch(), remove: useDeleteSavedSearch() }),
      { wrapper },
    );
    let pending!: Promise<unknown>;
    act(() => {
      pending = (
        kind === 'create'
          ? result.current.create.mutateAsync(input, { onSuccess })
          : result.current.remove.mutateAsync('same-id', { onSuccess })
      ).catch((error) => error);
    });
    await waitFor(() => expect(method).toHaveBeenCalled());
    switchToB(rerender);
    client.removeQueries({ queryKey: emailKeys.savedSearches });
    client.setQueryData(emailKeys.savedSearches, [search('B private')]);
    invalidate.mockClear();
    await act(async () => {
      resolve(kind === 'create' ? search('A result') : undefined);
      expect(await pending).toEqual(expect.objectContaining({ message: 'Email account changed' }));
    });
    expect(client.getQueryData(emailKeys.savedSearches)).toEqual([search('B private')]);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
    client.clear();
  },
);

it('does not optimistically write or send if account changes while cancellation waits', async () => {
  let finishCancel!: () => void;
  const { client, wrapper } = setup();
  jest.spyOn(client, 'cancelQueries').mockReturnValueOnce(
    new Promise((resolve) => {
      finishCancel = resolve;
    }),
  );
  const { result, rerender } = renderHook(() => useCreateSavedSearch(), { wrapper });
  let pending!: Promise<unknown>;
  act(() => {
    pending = result.current.mutateAsync(input).catch((error) => error);
  });
  await waitFor(() => expect(client.cancelQueries).toHaveBeenCalled());
  switchToB(rerender);
  client.setQueryData(emailKeys.savedSearches, [search('B private')]);
  await act(async () => {
    finishCancel();
    await pending;
  });
  expect(client.getQueryData(emailKeys.savedSearches)).toEqual([search('B private')]);
  expect(mockApiA.createSavedSearch).not.toHaveBeenCalled();
  expect(mockApiB.createSavedSearch).not.toHaveBeenCalled();
  client.clear();
});

it('preserves normal rollback and error reporting in the same account', async () => {
  mockApiA.deleteSavedSearch.mockRejectedValueOnce(new Error('network'));
  const { client, wrapper } = setup();
  client.setQueryData(emailKeys.savedSearches, [search('before')]);
  const { result } = renderHook(() => useDeleteSavedSearch(), { wrapper });
  await act(async () => {
    await expect(result.current.mutateAsync('same-id')).rejects.toThrow('network');
  });
  expect(client.getQueryData(emailKeys.savedSearches)).toEqual([search('before')]);
  expect(mockToast).toHaveBeenCalledWith('network');
  client.clear();
});

it.each(['create', 'delete'] as const)(
  'preserves same-account %s success and invalidation',
  async (kind) => {
    const method = kind === 'create' ? mockApiA.createSavedSearch : mockApiA.deleteSavedSearch;
    method.mockResolvedValueOnce(kind === 'create' ? search('created') : undefined);
    const { client, wrapper } = setup();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const onSuccess = jest.fn();
    const { result } = renderHook(
      () => ({ create: useCreateSavedSearch(), remove: useDeleteSavedSearch() }),
      { wrapper },
    );
    await act(async () => {
      if (kind === 'create') await result.current.create.mutateAsync(input, { onSuccess });
      else await result.current.remove.mutateAsync('same-id', { onSuccess });
    });
    expect(method).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: emailKeys.savedSearches });
    client.clear();
  },
);

it.each(['create', 'delete'] as const)(
  'rejects a retained %s action before changing the next account',
  async (kind) => {
    const { client, wrapper } = setup();
    const cancel = jest.spyOn(client, 'cancelQueries');
    const { result, rerender } = renderHook(
      () => ({ create: useCreateSavedSearch(), remove: useDeleteSavedSearch() }),
      { wrapper },
    );
    const staleCreate = result.current.create.mutateAsync;
    const staleDelete = result.current.remove.mutateAsync;
    switchToB(rerender);
    client.setQueryData(emailKeys.savedSearches, [search('B private')]);
    await act(async () => {
      const attempt = kind === 'create' ? staleCreate(input) : staleDelete('same-id');
      await expect(attempt).rejects.toThrow('Email account changed');
    });
    expect(cancel).not.toHaveBeenCalled();
    expect(mockApiA.createSavedSearch).not.toHaveBeenCalled();
    expect(mockApiA.deleteSavedSearch).not.toHaveBeenCalled();
    expect(mockApiB.createSavedSearch).not.toHaveBeenCalled();
    expect(mockApiB.deleteSavedSearch).not.toHaveBeenCalled();
    expect(client.getQueryData(emailKeys.savedSearches)).toEqual([search('B private')]);
    client.clear();
  },
);

it('preserves the existing no-snapshot failure behavior when the cache was absent', async () => {
  mockApiA.createSavedSearch.mockRejectedValueOnce(new Error('network'));
  const { client, wrapper } = setup();
  const { result } = renderHook(() => useCreateSavedSearch(), { wrapper });
  await act(async () => {
    await expect(result.current.mutateAsync(input)).rejects.toThrow('network');
  });
  expect(client.getQueryData(emailKeys.savedSearches)).toEqual([
    expect.objectContaining({ name: 'new', query: 'private query' }),
  ]);
  client.clear();
});

it.each(['create', 'delete'] as const)(
  'rejects %s while the bearer subject disagrees with the projected account',
  async (kind) => {
    mockBearerSubject = 'bob';
    const { client, wrapper } = setup();
    const cancel = jest.spyOn(client, 'cancelQueries');
    client.setQueryData(emailKeys.savedSearches, [search('A private')]);
    const { result } = renderHook(
      () => ({ create: useCreateSavedSearch(), remove: useDeleteSavedSearch() }),
      { wrapper },
    );
    await act(async () => {
      const attempt =
        kind === 'create'
          ? result.current.create.mutateAsync(input)
          : result.current.remove.mutateAsync('same-id');
      await expect(attempt).rejects.toThrow('Email account changed');
    });
    expect(cancel).not.toHaveBeenCalled();
    expect(mockApiA.createSavedSearch).not.toHaveBeenCalled();
    expect(mockApiA.deleteSavedSearch).not.toHaveBeenCalled();
    expect(client.getQueryData(emailKeys.savedSearches)).toEqual([search('A private')]);
    client.clear();
  },
);

it('retains compatibility with an opaque bearer whose subject is unavailable', async () => {
  mockBearerSubject = null;
  mockApiA.createSavedSearch.mockResolvedValueOnce(search('created'));
  const { client, wrapper } = setup();
  const { result } = renderHook(() => useCreateSavedSearch(), { wrapper });
  await act(async () => {
    await result.current.mutateAsync(input);
  });
  expect(mockApiA.createSavedSearch).toHaveBeenCalledWith(input);
  client.clear();
});

it('rejects a saved search without a bearer even when the projected user remains', async () => {
  mockToken = null;
  const { client, wrapper } = setup();
  const { result } = renderHook(() => useCreateSavedSearch(), { wrapper });
  await act(async () => {
    await expect(result.current.mutateAsync(input)).rejects.toThrow('Email account changed');
  });
  expect(mockApiA.createSavedSearch).not.toHaveBeenCalled();
  expect(client.getQueryData(emailKeys.savedSearches)).toBeUndefined();
  client.clear();
});
