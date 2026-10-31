import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Label } from '@/services/emailApi';
import { OxyServices } from '@oxy.so/core';
import { emailKeys } from '@/hooks/queries/queryKeys';

const mockApiA = { createLabel: jest.fn(), updateLabel: jest.fn(), deleteLabel: jest.fn() };
const mockApiB = { createLabel: jest.fn(), updateLabel: jest.fn(), deleteLabel: jest.fn() };
let mockCurrentApi: typeof mockApiA | null = mockApiA;
const mockToast = jest.fn();
let mockEpoch = 0;
const mockTokenListeners = new Set<() => void>();
const mockDefaultHttp = {
  getSessionEpoch: () => mockEpoch,
  addTokenChangeListener: (listener: () => void) => {
    mockTokenListeners.add(listener);
    return () => mockTokenListeners.delete(listener);
  },
};
let mockHttp: Pick<OxyServices['http'], 'getSessionEpoch' | 'addTokenChangeListener'> =
  mockDefaultHttp;

jest.mock('@/hooks/useEmail', () => ({
  useEmailStore: Object.assign(
    (selector: (state: { _api: typeof mockCurrentApi }) => unknown) =>
      selector({ _api: mockCurrentApi }),
    { getState: () => ({ _api: mockCurrentApi }) },
  ),
}));
jest.mock('@oxy.so/bloom/toast', () => ({
  toast: { error: (...args: unknown[]) => mockToast(...args) },
}));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({ oxyServices: { http: mockHttp } }),
}));

import { useCreateLabel, useDeleteLabel, useUpdateLabel } from '@/hooks/queries/useLabels';

const label = (name: string) => ({ _id: 'shared-id', name, color: '#000' }) as Label;
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
  mockHttp = mockDefaultHttp;
});

it('does not roll A labels back into B after the old mutation fails', async () => {
  let reject!: (error: Error) => void;
  mockApiA.updateLabel.mockReturnValueOnce(
    new Promise((_resolve, rejectPromise) => {
      reject = rejectPromise;
    }),
  );
  const { client, wrapper } = setup();
  client.setQueryData(emailKeys.labels, [label('A private')]);
  const { result } = renderHook(() => useUpdateLabel(), { wrapper });
  let operation!: Promise<unknown>;
  act(() => {
    operation = result.current
      .mutateAsync({ labelId: 'shared-id', updates: { name: 'A edit' } })
      .catch(() => undefined);
  });
  await waitFor(() => expect(mockApiA.updateLabel).toHaveBeenCalled());
  mockCurrentApi = mockApiB;
  client.clear();
  client.setQueryData(emailKeys.labels, [label('B private')]);
  await act(async () => {
    reject(new Error('A failed'));
    await operation;
  });
  expect(client.getQueryData(emailKeys.labels)).toEqual([label('B private')]);
  expect(mockToast).not.toHaveBeenCalled();
});

it('does not start an A mutation after the account changes while cancelling a query', async () => {
  let finishCancel!: () => void;
  const { client, wrapper } = setup();
  jest.spyOn(client, 'cancelQueries').mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finishCancel = resolve;
    }),
  );
  client.setQueryData(emailKeys.labels, [label('A private')]);
  const { result, rerender } = renderHook(() => useUpdateLabel(), { wrapper });
  let operation!: Promise<unknown>;
  act(() => {
    operation = result.current
      .mutateAsync({ labelId: 'shared-id', updates: { name: 'A edit' } })
      .catch(() => undefined);
  });
  await waitFor(() => expect(client.cancelQueries).toHaveBeenCalled());
  mockCurrentApi = mockApiB;
  act(() => rerender());
  client.clear();
  client.setQueryData(emailKeys.labels, [label('B private')]);
  await act(async () => {
    finishCancel();
    await operation;
  });
  expect(client.getQueryData(emailKeys.labels)).toEqual([label('B private')]);
  expect(mockApiA.updateLabel).not.toHaveBeenCalled();
  expect(mockApiB.updateLabel).not.toHaveBeenCalled();
  expect(mockToast).not.toHaveBeenCalled();
});

it('does not use the replacement observer callbacks for a pending A mutation', async () => {
  let reject!: (error: Error) => void;
  mockApiA.updateLabel.mockReturnValueOnce(
    new Promise((_resolve, rejectPromise) => {
      reject = rejectPromise;
    }),
  );
  const { client, wrapper } = setup();
  client.setQueryData(emailKeys.labels, [label('A private')]);
  const { result, rerender } = renderHook(() => useUpdateLabel(), { wrapper });
  let operation!: Promise<unknown>;
  act(() => {
    operation = result.current
      .mutateAsync({ labelId: 'shared-id', updates: { name: 'A edit' } })
      .catch(() => undefined);
  });
  await waitFor(() => expect(mockApiA.updateLabel).toHaveBeenCalled());
  mockCurrentApi = mockApiB;
  act(() => rerender());
  client.clear();
  client.setQueryData(emailKeys.labels, [label('B private')]);
  await act(async () => {
    reject(new Error('A failed'));
    await operation;
  });
  expect(client.getQueryData(emailKeys.labels)).toEqual([label('B private')]);
  expect(mockToast).not.toHaveBeenCalled();
});

it('does not invoke an old render callback under the replacement account', async () => {
  const { client, wrapper } = setup();
  const cancel = jest.spyOn(client, 'cancelQueries');
  const { result, rerender } = renderHook(() => useUpdateLabel(), { wrapper });
  const oldMutate = result.current.mutateAsync;
  mockCurrentApi = mockApiB;
  act(() => rerender());
  client.clear();
  client.setQueryData(emailKeys.labels, [label('B private')]);
  await act(async () => {
    await oldMutate({ labelId: 'shared-id', updates: { name: 'A edit' } }).catch(() => undefined);
  });
  expect(cancel).not.toHaveBeenCalled();
  expect(mockApiA.updateLabel).not.toHaveBeenCalled();
  expect(mockApiB.updateLabel).not.toHaveBeenCalled();
  expect(client.getQueryData(emailKeys.labels)).toEqual([label('B private')]);
  expect(mockToast).not.toHaveBeenCalled();
});

it('ignores success and caller callbacks after the originating account is replaced', async () => {
  let resolve!: (value: Label) => void;
  mockApiA.updateLabel.mockReturnValueOnce(
    new Promise((resolvePromise) => {
      resolve = resolvePromise;
    }),
  );
  const { client, wrapper } = setup();
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const onSuccess = jest.fn();
  const { result, rerender } = renderHook(() => useUpdateLabel(), { wrapper });
  act(() => {
    result.current.mutate({ labelId: 'shared-id', updates: { name: 'A edit' } }, { onSuccess });
  });
  await waitFor(() => expect(mockApiA.updateLabel).toHaveBeenCalled());
  mockCurrentApi = mockApiB;
  act(() => rerender());
  client.clear();
  invalidate.mockClear();
  await act(async () => {
    resolve(label('A edit'));
    await Promise.resolve();
  });
  expect(onSuccess).not.toHaveBeenCalled();
  expect(invalidate).not.toHaveBeenCalled();
});

it('does not serialize the owning API into mutation variables', async () => {
  let resolve!: (value: Label) => void;
  mockApiA.updateLabel.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const { client, wrapper } = setup();
  const { result } = renderHook(() => useUpdateLabel(), { wrapper });
  let pending!: Promise<unknown>;
  act(() => {
    pending = result.current.mutateAsync({ labelId: 'shared-id', updates: { name: 'edit' } });
  });
  await waitFor(() => expect(mockApiA.updateLabel).toHaveBeenCalled());
  const mutation = client.getMutationCache().getAll()[0];
  expect(mutation.state.context).toBeUndefined();
  expect(JSON.parse(JSON.stringify(mutation.state.variables))).toEqual({
    input: { labelId: 'shared-id', updates: { name: 'edit' } },
  });
  await act(async () => {
    resolve(label('edit'));
    await pending;
  });
});

it.each(['create', 'delete'] as const)(
  'does not roll an old %s mutation into the next account',
  async (kind) => {
    let reject!: (error: Error) => void;
    const method = kind === 'create' ? mockApiA.createLabel : mockApiA.deleteLabel;
    method.mockReturnValueOnce(
      new Promise((_resolve, rejectPromise) => {
        reject = rejectPromise;
      }),
    );
    const { client, wrapper } = setup();
    client.setQueryData(emailKeys.labels, [label('A private')]);
    const { result, rerender } = renderHook(
      () => ({ create: useCreateLabel(), remove: useDeleteLabel() }),
      { wrapper },
    );
    let operation!: Promise<unknown>;
    act(() => {
      operation = (
        kind === 'create'
          ? result.current.create.mutateAsync({ name: 'A new', color: '#000' })
          : result.current.remove.mutateAsync('shared-id')
      ).catch(() => undefined);
    });
    await waitFor(() => expect(method).toHaveBeenCalled());
    mockCurrentApi = mockApiB;
    act(() => rerender());
    client.clear();
    client.setQueryData(emailKeys.labels, [label('B private')]);
    await act(async () => {
      reject(new Error('A failed'));
      await operation;
    });
    expect(client.getQueryData(emailKeys.labels)).toEqual([label('B private')]);
    expect(mockToast).not.toHaveBeenCalled();
  },
);

it('does not restore A state after switching away and returning to A', async () => {
  let reject!: (error: Error) => void;
  mockApiA.updateLabel.mockReturnValueOnce(
    new Promise((_resolve, fail) => {
      reject = fail;
    }),
  );
  const { client, wrapper } = setup();
  client.setQueryData(emailKeys.labels, [label('old A')]);
  const { result, rerender } = renderHook(() => useUpdateLabel(), { wrapper });
  let operation!: Promise<unknown>;
  act(() => {
    operation = result.current
      .mutateAsync({ labelId: 'shared-id', updates: { name: 'old A edit' } })
      .catch(() => undefined);
  });
  await waitFor(() => expect(mockApiA.updateLabel).toHaveBeenCalled());
  mockCurrentApi = mockApiB;
  act(() => rerender());
  client.clear();
  mockCurrentApi = { createLabel: jest.fn(), updateLabel: jest.fn(), deleteLabel: jest.fn() };
  act(() => rerender());
  client.setQueryData(emailKeys.labels, [label('new A')]);
  await act(async () => {
    reject(new Error('old A failed'));
    await operation;
  });
  expect(client.getQueryData(emailKeys.labels)).toEqual([label('new A')]);
  expect(mockToast).not.toHaveBeenCalled();
});

it('does not expose a pending A mutation to a still-mounted B consumer', async () => {
  let resolve!: (value: Label) => void;
  mockApiA.updateLabel.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const { client, wrapper } = setup();
  client.setQueryData(emailKeys.labels, [label('A private')]);
  const { result, rerender } = renderHook(() => useUpdateLabel(), { wrapper });
  let pending!: Promise<unknown>;
  act(() => {
    pending = result.current
      .mutateAsync({ labelId: 'shared-id', updates: { name: 'A edit' } })
      .catch((error) => error);
  });
  await waitFor(() => expect(result.current.isPending).toBe(true));
  mockCurrentApi = mockApiB;
  act(() => rerender());
  expect(result.current.isPending).toBe(false);
  expect(result.current.status).toBe('idle');
  expect(result.current.variables).toBeUndefined();
  expect(result.current.data).toBeUndefined();
  await act(async () => {
    resolve(label('A private response'));
    expect(await pending).toEqual(expect.objectContaining({ message: 'Email account changed' }));
  });
});

it('does not optimistically write when no account API is available', async () => {
  mockCurrentApi = null;
  const { client, wrapper } = setup();
  client.setQueryData(emailKeys.labels, [label('existing')]);
  const cancel = jest.spyOn(client, 'cancelQueries');
  const { result } = renderHook(() => useUpdateLabel(), { wrapper });
  await act(async () => {
    await expect(
      result.current.mutateAsync({ labelId: 'shared-id', updates: { name: 'bad edit' } }),
    ).rejects.toThrow();
  });
  expect(cancel).not.toHaveBeenCalled();
  expect(client.getQueryData(emailKeys.labels)).toEqual([label('existing')]);
  expect(mockToast).not.toHaveBeenCalled();
});

it('rejects old callbacks when the session changes but the API instance stays the same', async () => {
  const { client, wrapper } = setup();
  client.setQueryData(emailKeys.labels, [label('current')]);
  const { result } = renderHook(() => useUpdateLabel(), { wrapper });
  const oldMutate = result.current.mutateAsync;
  act(() => {
    mockEpoch += 1;
    for (const listener of mockTokenListeners) listener();
  });
  await act(async () => {
    await expect(oldMutate({ labelId: 'shared-id', updates: { name: 'old' } })).rejects.toThrow(
      'Email account changed',
    );
  });
  expect(mockApiA.updateLabel).not.toHaveBeenCalled();
  expect(client.getQueryData(emailKeys.labels)).toEqual([label('current')]);
  mockApiA.updateLabel.mockResolvedValueOnce(label('new'));
  await act(async () => {
    await result.current.mutateAsync({ labelId: 'shared-id', updates: { name: 'new' } });
  });
  expect(mockApiA.updateLabel).toHaveBeenCalledTimes(1);
});

it('ignores an old response after same-account session replacement', async () => {
  let resolve!: (value: Label) => void;
  mockApiA.updateLabel.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const { client, wrapper } = setup();
  client.setQueryData(emailKeys.labels, [label('old session')]);
  const { result } = renderHook(() => useUpdateLabel(), { wrapper });
  let pending!: Promise<unknown>;
  act(() => {
    pending = result.current
      .mutateAsync({ labelId: 'shared-id', updates: { name: 'old edit' } })
      .catch((error) => error);
  });
  await waitFor(() => expect(mockApiA.updateLabel).toHaveBeenCalled());
  act(() => {
    mockEpoch += 1;
    for (const listener of mockTokenListeners) listener();
  });
  client.clear();
  client.setQueryData(emailKeys.labels, [label('new session')]);
  await act(async () => {
    resolve(label('old session response'));
    expect(await pending).toEqual(expect.objectContaining({ message: 'Email account changed' }));
  });
  expect(client.getQueryData(emailKeys.labels)).toEqual([label('new session')]);
  expect(mockToast).not.toHaveBeenCalled();
});

const token = (userId: string, sessionId: string, version: number) =>
  `e30.${Buffer.from(JSON.stringify({ userId, sessionId, version, exp: 2000000000 })).toString('base64url')}.fixture`;

it('uses the real SDK epoch to reject an A callback after A→B→A', async () => {
  const oxy = new OxyServices({ baseURL: 'http://localhost:4110' });
  oxy.session.setAccessToken(token('a', 'session-a', 1));
  mockHttp = oxy.http;
  const { wrapper } = setup();
  const { result, unmount } = renderHook(() => useUpdateLabel(), { wrapper });
  const oldMutate = result.current.mutateAsync;
  act(() => {
    oxy.session.setAccessToken(token('b', 'session-b', 1));
    oxy.session.setAccessToken(token('a', 'session-a', 2));
  });
  await act(async () => {
    await expect(oldMutate({ labelId: 'shared-id', updates: { name: 'old' } })).rejects.toThrow(
      'Email account changed',
    );
  });
  expect(mockApiA.updateLabel).not.toHaveBeenCalled();
  unmount();
  oxy.dispose();
});

it('keeps callbacks valid after a real SDK token rotation within one session', async () => {
  const oxy = new OxyServices({ baseURL: 'http://localhost:4110' });
  oxy.session.setAccessToken(token('a', 'session-a', 1));
  mockHttp = oxy.http;
  const { wrapper } = setup();
  const { result, unmount } = renderHook(() => useUpdateLabel(), { wrapper });
  const mutate = result.current.mutateAsync;
  mockApiA.updateLabel.mockResolvedValueOnce(label('saved'));
  act(() => oxy.session.setAccessToken(token('a', 'session-a', 2)));
  await act(async () => {
    await mutate({ labelId: 'shared-id', updates: { name: 'saved' } });
  });
  expect(mockApiA.updateLabel).toHaveBeenCalledTimes(1);
  unmount();
  oxy.dispose();
});

it('rejects an old label callback after the real SDK transitions A→401→empty→B', async () => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = jest.fn(async () => ({
    ok: false,
    status: 401,
    statusText: 'Unauthorized',
    headers: { get: () => 'application/json' },
    json: async () => ({ error: 'expired' }),
    text: async () => '{"error":"expired"}',
    clone() {
      return this;
    },
  })) as never;
  const oxy = new OxyServices({
    baseURL: 'https://api.test',
    enableRetry: false,
    enableCache: false,
  });
  oxy.session.setAccessToken(token('a', 'session-a', 1));
  mockHttp = oxy.http;
  const { client, wrapper } = setup();
  const { result, unmount } = renderHook(() => useUpdateLabel(), { wrapper });
  const oldMutate = result.current.mutateAsync;
  try {
    await act(async () => {
      await expect(
        oxy.http.get('/expired', { retry: false, deduplicate: false }),
      ).rejects.toMatchObject({ status: 401 });
    });
    expect(oxy.http.getAccessToken()).toBeNull();
    act(() => oxy.session.setAccessToken(token('b', 'session-b', 1)));
    client.clear();
    client.setQueryData(emailKeys.labels, [label('B private')]);
    await act(async () => {
      await expect(
        oldMutate({ labelId: 'shared-id', updates: { name: 'A edit' } }),
      ).rejects.toThrow('Email account changed');
    });
    expect(mockApiA.updateLabel).not.toHaveBeenCalled();
    expect(client.getQueryData(emailKeys.labels)).toEqual([label('B private')]);
  } finally {
    unmount();
    oxy.dispose();
    globalThis.fetch = oldFetch;
  }
});
