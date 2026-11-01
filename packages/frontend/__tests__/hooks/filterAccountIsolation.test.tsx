import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { emailKeys } from '@/hooks/queries/queryKeys';
import type { EmailFilter } from '@/services/emailApi';

const mockApiA = {
  createFilter: jest.fn(),
  updateFilter: jest.fn(),
  deleteFilter: jest.fn(),
};
const mockApiB = {
  createFilter: jest.fn(),
  updateFilter: jest.fn(),
  deleteFilter: jest.fn(),
};
let mockCurrentApi: typeof mockApiA | null = mockApiA;
let mockEpoch = 0;
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
  useOxy: () => ({ user: { id: 'alice' }, oxyServices: { http: mockHttp, session: mockSession } }),
}));
jest.mock('@oxy.so/bloom/toast', () => ({
  toast: { error: (...args: unknown[]) => mockToast(...args) },
}));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import {
  useCreateFilter,
  useDeleteFilter,
  useUpdateFilter,
} from '@/hooks/mutations/useFilterMutations';

const filter = (name: string) => ({ _id: 'same-id', name }) as EmailFilter;
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}
beforeEach(() => {
  jest.clearAllMocks();
  mockCurrentApi = mockApiA;
  mockEpoch = 0;
  mockBearerSubject = 'alice';
  mockToken = 'token';
});

it('does not roll A filters into B after an old mutation fails', async () => {
  let reject!: (error: Error) => void;
  mockApiA.updateFilter.mockReturnValueOnce(
    new Promise((_resolve, fail) => {
      reject = fail;
    }),
  );
  const { client, wrapper } = setup();
  client.setQueryData(emailKeys.filters, [filter('A private')]);
  const { result, rerender } = renderHook(() => useUpdateFilter(), { wrapper });
  let pending!: Promise<unknown>;
  act(() => {
    pending = result.current
      .mutateAsync({ filterId: 'same-id', name: 'A edit' })
      .catch(() => undefined);
  });
  await waitFor(() => expect(mockApiA.updateFilter).toHaveBeenCalled());
  mockCurrentApi = mockApiB;
  act(() => {
    mockEpoch++;
    for (const listener of mockListeners) listener();
    rerender();
  });
  client.clear();
  client.setQueryData(emailKeys.filters, [filter('B private')]);
  await act(async () => {
    reject(new Error('old failure'));
    await pending;
  });
  expect(client.getQueryData(emailKeys.filters)).toEqual([filter('B private')]);
  expect(mockToast).not.toHaveBeenCalled();
});

it('rejects an old render callback before it touches B or sends a request', async () => {
  const { client, wrapper } = setup();
  const cancel = jest.spyOn(client, 'cancelQueries');
  const { result, rerender } = renderHook(() => useUpdateFilter(), { wrapper });
  const oldMutate = result.current.mutateAsync;
  mockCurrentApi = mockApiB;
  act(() => {
    mockEpoch++;
    for (const listener of mockListeners) listener();
    rerender();
  });
  client.clear();
  client.setQueryData(emailKeys.filters, [filter('B private')]);
  await act(async () => {
    await oldMutate({ filterId: 'same-id', name: 'A edit' }).catch(() => undefined);
  });
  expect(cancel).not.toHaveBeenCalled();
  expect(mockApiA.updateFilter).not.toHaveBeenCalled();
  expect(mockApiB.updateFilter).not.toHaveBeenCalled();
  expect(client.getQueryData(emailKeys.filters)).toEqual([filter('B private')]);
});

it('does not write optimistic data when cancellation finishes after switching accounts', async () => {
  let finishCancel!: () => void;
  const { client, wrapper } = setup();
  jest.spyOn(client, 'cancelQueries').mockReturnValueOnce(
    new Promise((resolve) => {
      finishCancel = resolve;
    }),
  );
  const { result, rerender } = renderHook(() => useUpdateFilter(), { wrapper });
  let pending!: Promise<unknown>;
  act(() => {
    pending = result.current
      .mutateAsync({ filterId: 'same-id', name: 'A edit' })
      .catch(() => undefined);
  });
  await waitFor(() => expect(client.cancelQueries).toHaveBeenCalled());
  mockCurrentApi = mockApiB;
  act(() => {
    mockEpoch++;
    for (const listener of mockListeners) listener();
    rerender();
  });
  client.clear();
  client.setQueryData(emailKeys.filters, [filter('B private')]);
  await act(async () => {
    finishCancel();
    await pending;
  });
  expect(client.getQueryData(emailKeys.filters)).toEqual([filter('B private')]);
  expect(mockApiA.updateFilter).not.toHaveBeenCalled();
  expect(mockApiB.updateFilter).not.toHaveBeenCalled();
  expect(mockToast).not.toHaveBeenCalled();
});

it('suppresses old success, invalidation and the pending observer state after switching accounts', async () => {
  let resolve!: (value: EmailFilter) => void;
  mockApiA.updateFilter.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const { client, wrapper } = setup();
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const onSuccess = jest.fn();
  const { result, rerender } = renderHook(() => useUpdateFilter(), { wrapper });
  act(() => {
    result.current.mutate({ filterId: 'same-id', name: 'A edit' }, { onSuccess });
  });
  await waitFor(() => expect(result.current.isPending).toBe(true));
  mockCurrentApi = mockApiB;
  act(() => {
    mockEpoch++;
    for (const listener of mockListeners) listener();
    rerender();
  });
  expect(result.current.isPending).toBe(false);
  expect(result.current.variables).toBeUndefined();
  client.clear();
  invalidate.mockClear();
  await act(async () => {
    resolve(filter('A response'));
    await Promise.resolve();
  });
  expect(onSuccess).not.toHaveBeenCalled();
  expect(invalidate).not.toHaveBeenCalled();
});

it('rejects an old callback after A→B→A even when the API object is reused', async () => {
  const { client, wrapper } = setup();
  const { result } = renderHook(() => useUpdateFilter(), { wrapper });
  const oldMutate = result.current.mutateAsync;
  act(() => {
    mockEpoch += 2;
    for (const listener of mockListeners) listener();
  });
  client.setQueryData(emailKeys.filters, [filter('new A')]);
  await act(async () => {
    await expect(oldMutate({ filterId: 'same-id', name: 'old A' })).rejects.toThrow(
      'Email account changed',
    );
  });
  expect(mockApiA.updateFilter).not.toHaveBeenCalled();
  expect(client.getQueryData(emailKeys.filters)).toEqual([filter('new A')]);
});

it('preserves normal rollback and error reporting within the same session', async () => {
  mockApiA.updateFilter.mockRejectedValueOnce(new Error('network'));
  const { client, wrapper } = setup();
  client.setQueryData(emailKeys.filters, [filter('before')]);
  const { result } = renderHook(() => useUpdateFilter(), { wrapper });
  await act(async () => {
    await expect(result.current.mutateAsync({ filterId: 'same-id', name: 'edit' })).rejects.toThrow(
      'network',
    );
  });
  expect(client.getQueryData(emailKeys.filters)).toEqual([filter('before')]);
  expect(mockToast).toHaveBeenCalledWith('ui.mutations.filterUpdateFailed');
});

it('does not optimistically write without an API', async () => {
  mockCurrentApi = null;
  const { client, wrapper } = setup();
  const cancel = jest.spyOn(client, 'cancelQueries');
  const { result } = renderHook(() => useUpdateFilter(), { wrapper });
  await act(async () => {
    await expect(
      result.current.mutateAsync({ filterId: 'same-id', name: 'edit' }),
    ).rejects.toThrow();
  });
  expect(cancel).not.toHaveBeenCalled();
  expect(mockToast).not.toHaveBeenCalled();
});

it.each(['create', 'delete'] as const)('does not roll back old %s into B', async (kind) => {
  let reject!: (error: Error) => void;
  const method = kind === 'create' ? mockApiA.createFilter : mockApiA.deleteFilter;
  method.mockReturnValueOnce(
    new Promise((_resolve, fail) => {
      reject = fail;
    }),
  );
  const { client, wrapper } = setup();
  client.setQueryData(emailKeys.filters, [filter('A private')]);
  const { result, rerender } = renderHook(
    () => ({ create: useCreateFilter(), remove: useDeleteFilter() }),
    { wrapper },
  );
  let pending!: Promise<unknown>;
  act(() => {
    pending = (
      kind === 'create'
        ? result.current.create.mutateAsync({ name: 'A new', conditions: [], actions: [] })
        : result.current.remove.mutateAsync('same-id')
    ).catch(() => undefined);
  });
  await waitFor(() => expect(method).toHaveBeenCalled());
  mockCurrentApi = mockApiB;
  act(() => {
    mockEpoch++;
    for (const listener of mockListeners) listener();
    rerender();
  });
  client.clear();
  client.setQueryData(emailKeys.filters, [filter('B private')]);
  await act(async () => {
    reject(new Error('old failure'));
    await pending;
  });
  expect(client.getQueryData(emailKeys.filters)).toEqual([filter('B private')]);
  expect(mockToast).not.toHaveBeenCalled();
});

it('keeps rollback snapshots outside serializable mutation state and rejects late async results', async () => {
  let resolve!: (value: EmailFilter) => void;
  mockApiA.updateFilter.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const { client, wrapper } = setup();
  client.setQueryData(emailKeys.filters, [filter('A private')]);
  const { result, rerender } = renderHook(() => useUpdateFilter(), { wrapper });
  let pending!: Promise<unknown>;
  act(() => {
    pending = result.current
      .mutateAsync({ filterId: 'same-id', name: 'A edit' })
      .catch((error) => error);
  });
  await waitFor(() => expect(mockApiA.updateFilter).toHaveBeenCalled());
  const mutation = client.getMutationCache().getAll()[0];
  expect(mutation.state.context).toBeUndefined();
  expect(JSON.parse(JSON.stringify(mutation.state.variables))).toEqual({
    input: { filterId: 'same-id', name: 'A edit' },
  });
  mockCurrentApi = mockApiB;
  act(() => {
    mockEpoch++;
    for (const listener of mockListeners) listener();
    rerender();
  });
  await act(async () => {
    resolve(filter('A response'));
    expect(await pending).toEqual(expect.objectContaining({ message: 'Email account changed' }));
  });
});

it.each(['create', 'update', 'delete'] as const)(
  'rejects %s when the known bearer subject disagrees with the projected account',
  async (kind) => {
    mockBearerSubject = 'bob';
    const { client, wrapper } = setup();
    const cancel = jest.spyOn(client, 'cancelQueries');
    client.setQueryData(emailKeys.filters, [filter('A private')]);
    const { result } = renderHook(
      () => ({ create: useCreateFilter(), update: useUpdateFilter(), remove: useDeleteFilter() }),
      { wrapper },
    );
    await act(async () => {
      const attempt =
        kind === 'create'
          ? result.current.create.mutateAsync({ name: 'A', conditions: [], actions: [] })
          : kind === 'update'
            ? result.current.update.mutateAsync({ filterId: 'same-id', name: 'A' })
            : result.current.remove.mutateAsync('same-id');
      await expect(attempt).rejects.toThrow('Email account changed');
    });
    expect(cancel).not.toHaveBeenCalled();
    expect(mockApiA.createFilter).not.toHaveBeenCalled();
    expect(mockApiA.updateFilter).not.toHaveBeenCalled();
    expect(mockApiA.deleteFilter).not.toHaveBeenCalled();
    expect(client.getQueryData(emailKeys.filters)).toEqual([filter('A private')]);
    expect(mockToast).not.toHaveBeenCalled();
    client.clear();
  },
);

it.each(['create', 'update', 'delete'] as const)(
  'continues allowing %s with an opaque bearer',
  async (kind) => {
    mockBearerSubject = null;
    const method =
      kind === 'create'
        ? mockApiA.createFilter
        : kind === 'update'
          ? mockApiA.updateFilter
          : mockApiA.deleteFilter;
    method.mockResolvedValueOnce(kind === 'delete' ? undefined : filter('done'));
    const { client, wrapper } = setup();
    const { result } = renderHook(
      () => ({ create: useCreateFilter(), update: useUpdateFilter(), remove: useDeleteFilter() }),
      { wrapper },
    );
    await act(async () => {
      if (kind === 'create')
        await result.current.create.mutateAsync({ name: 'A', conditions: [], actions: [] });
      else if (kind === 'update')
        await result.current.update.mutateAsync({ filterId: 'same-id', name: 'A' });
      else await result.current.remove.mutateAsync('same-id');
    });
    expect(method).toHaveBeenCalledTimes(1);
    client.clear();
  },
);

it('suppresses a late filter success when the bearer subject changes before projection', async () => {
  let resolve!: (value: EmailFilter) => void;
  mockApiA.updateFilter.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const { client, wrapper } = setup();
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const onSuccess = jest.fn();
  const { result } = renderHook(() => useUpdateFilter(), { wrapper });
  let pending!: Promise<unknown>;
  act(() => {
    pending = result.current
      .mutateAsync({ filterId: 'same-id', name: 'A' }, { onSuccess })
      .catch((error) => error);
  });
  await waitFor(() => expect(mockApiA.updateFilter).toHaveBeenCalled());
  mockBearerSubject = 'bob';
  invalidate.mockClear();
  await act(async () => {
    resolve(filter('A result'));
    expect(await pending).toEqual(expect.objectContaining({ message: 'Email account changed' }));
  });
  expect(onSuccess).not.toHaveBeenCalled();
  expect(invalidate).not.toHaveBeenCalled();
  client.clear();
});

it('rejects a filter write without a bearer', async () => {
  mockToken = null;
  const { client, wrapper } = setup();
  const { result } = renderHook(() => useCreateFilter(), { wrapper });
  await act(async () => {
    await expect(
      result.current.mutateAsync({ name: 'A', conditions: [], actions: [] }),
    ).rejects.toThrow('Email account changed');
  });
  expect(mockApiA.createFilter).not.toHaveBeenCalled();
  expect(client.getQueryData(emailKeys.filters)).toBeUndefined();
  client.clear();
});
