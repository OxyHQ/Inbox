import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { emailKeys } from '@/hooks/queries/queryKeys';
import type { EmailTemplate } from '@/services/emailApi';

const mockApiA = {
  createTemplate: jest.fn(),
  updateTemplate: jest.fn(),
  deleteTemplate: jest.fn(),
};
const mockApiB = {
  createTemplate: jest.fn(),
  updateTemplate: jest.fn(),
  deleteTemplate: jest.fn(),
};
let mockCurrentApi: typeof mockApiA | null = mockApiA;
let mockEpoch = 0;
const mockListeners = new Set<() => void>();
const mockHttp = {
  getSessionEpoch: () => mockEpoch,
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
  useOxy: () => ({ oxyServices: { http: mockHttp } }),
}));
jest.mock('@oxy.so/bloom/toast', () => ({
  toast: { error: (...args: unknown[]) => mockToast(...args) },
}));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import {
  useCreateTemplate,
  useDeleteTemplate,
  useUpdateTemplate,
} from '@/hooks/mutations/useTemplateMutations';

const template = (name: string) => ({ _id: 'same-id', name }) as EmailTemplate;
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
});

it('does not roll A templates into B after an old mutation fails', async () => {
  let reject!: (error: Error) => void;
  mockApiA.updateTemplate.mockReturnValueOnce(
    new Promise((_resolve, fail) => {
      reject = fail;
    }),
  );
  const { client, wrapper } = setup();
  client.setQueryData(emailKeys.templates, [template('A private')]);
  const { result, rerender } = renderHook(() => useUpdateTemplate(), { wrapper });
  let pending!: Promise<unknown>;
  act(() => {
    pending = result.current
      .mutateAsync({ templateId: 'same-id', name: 'A edit' })
      .catch(() => undefined);
  });
  await waitFor(() => expect(mockApiA.updateTemplate).toHaveBeenCalled());
  mockCurrentApi = mockApiB;
  act(() => {
    mockEpoch++;
    for (const listener of mockListeners) listener();
    rerender();
  });
  client.clear();
  client.setQueryData(emailKeys.templates, [template('B private')]);
  await act(async () => {
    reject(new Error('old failure'));
    await pending;
  });
  expect(client.getQueryData(emailKeys.templates)).toEqual([template('B private')]);
  expect(mockToast).not.toHaveBeenCalled();
});

it('rejects an old render callback before it touches B or sends a request', async () => {
  const { client, wrapper } = setup();
  const cancel = jest.spyOn(client, 'cancelQueries');
  const { result, rerender } = renderHook(() => useUpdateTemplate(), { wrapper });
  const oldMutate = result.current.mutateAsync;
  mockCurrentApi = mockApiB;
  act(() => {
    mockEpoch++;
    for (const listener of mockListeners) listener();
    rerender();
  });
  client.clear();
  client.setQueryData(emailKeys.templates, [template('B private')]);
  await act(async () => {
    await oldMutate({ templateId: 'same-id', name: 'A edit' }).catch(() => undefined);
  });
  expect(cancel).not.toHaveBeenCalled();
  expect(mockApiA.updateTemplate).not.toHaveBeenCalled();
  expect(mockApiB.updateTemplate).not.toHaveBeenCalled();
  expect(client.getQueryData(emailKeys.templates)).toEqual([template('B private')]);
});

it('does not write optimistic data when cancellation finishes after switching accounts', async () => {
  let finishCancel!: () => void;
  const { client, wrapper } = setup();
  jest.spyOn(client, 'cancelQueries').mockReturnValueOnce(
    new Promise((resolve) => {
      finishCancel = resolve;
    }),
  );
  const { result, rerender } = renderHook(() => useUpdateTemplate(), { wrapper });
  let pending!: Promise<unknown>;
  act(() => {
    pending = result.current
      .mutateAsync({ templateId: 'same-id', name: 'A edit' })
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
  client.setQueryData(emailKeys.templates, [template('B private')]);
  await act(async () => {
    finishCancel();
    await pending;
  });
  expect(client.getQueryData(emailKeys.templates)).toEqual([template('B private')]);
  expect(mockApiA.updateTemplate).not.toHaveBeenCalled();
  expect(mockApiB.updateTemplate).not.toHaveBeenCalled();
  expect(mockToast).not.toHaveBeenCalled();
});

it('suppresses old success, invalidation and the pending observer state after switching accounts', async () => {
  let resolve!: (value: EmailTemplate) => void;
  mockApiA.updateTemplate.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const { client, wrapper } = setup();
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const onSuccess = jest.fn();
  const { result, rerender } = renderHook(() => useUpdateTemplate(), { wrapper });
  act(() => {
    result.current.mutate({ templateId: 'same-id', name: 'A edit' }, { onSuccess });
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
    resolve(template('A response'));
    await Promise.resolve();
  });
  expect(onSuccess).not.toHaveBeenCalled();
  expect(invalidate).not.toHaveBeenCalled();
});

it('rejects an old callback after A→B→A even when the API object is reused', async () => {
  const { client, wrapper } = setup();
  const { result } = renderHook(() => useUpdateTemplate(), { wrapper });
  const oldMutate = result.current.mutateAsync;
  act(() => {
    mockEpoch += 2;
    for (const listener of mockListeners) listener();
  });
  client.setQueryData(emailKeys.templates, [template('new A')]);
  await act(async () => {
    await expect(oldMutate({ templateId: 'same-id', name: 'old A' })).rejects.toThrow(
      'Email account changed',
    );
  });
  expect(mockApiA.updateTemplate).not.toHaveBeenCalled();
  expect(client.getQueryData(emailKeys.templates)).toEqual([template('new A')]);
});

it('preserves normal rollback and error reporting within the same session', async () => {
  mockApiA.updateTemplate.mockRejectedValueOnce(new Error('network'));
  const { client, wrapper } = setup();
  client.setQueryData(emailKeys.templates, [template('before')]);
  const { result } = renderHook(() => useUpdateTemplate(), { wrapper });
  await act(async () => {
    await expect(
      result.current.mutateAsync({ templateId: 'same-id', name: 'edit' }),
    ).rejects.toThrow('network');
  });
  expect(client.getQueryData(emailKeys.templates)).toEqual([template('before')]);
  expect(mockToast).toHaveBeenCalledWith('ui.mutations.templateUpdateFailed');
});

it('does not optimistically write without an API', async () => {
  mockCurrentApi = null;
  const { client, wrapper } = setup();
  const cancel = jest.spyOn(client, 'cancelQueries');
  const { result } = renderHook(() => useUpdateTemplate(), { wrapper });
  await act(async () => {
    await expect(
      result.current.mutateAsync({ templateId: 'same-id', name: 'edit' }),
    ).rejects.toThrow();
  });
  expect(cancel).not.toHaveBeenCalled();
  expect(mockToast).not.toHaveBeenCalled();
});

it.each(['create', 'delete'] as const)('does not roll back old %s into B', async (kind) => {
  let reject!: (error: Error) => void;
  const method = kind === 'create' ? mockApiA.createTemplate : mockApiA.deleteTemplate;
  method.mockReturnValueOnce(
    new Promise((_resolve, fail) => {
      reject = fail;
    }),
  );
  const { client, wrapper } = setup();
  client.setQueryData(emailKeys.templates, [template('A private')]);
  const { result, rerender } = renderHook(
    () => ({ create: useCreateTemplate(), remove: useDeleteTemplate() }),
    { wrapper },
  );
  let pending!: Promise<unknown>;
  act(() => {
    pending = (
      kind === 'create'
        ? result.current.create.mutateAsync({ name: 'A new', body: 'secret' })
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
  client.setQueryData(emailKeys.templates, [template('B private')]);
  await act(async () => {
    reject(new Error('old failure'));
    await pending;
  });
  expect(client.getQueryData(emailKeys.templates)).toEqual([template('B private')]);
  expect(mockToast).not.toHaveBeenCalled();
});

it('keeps rollback snapshots outside serializable mutation state and rejects late async results', async () => {
  let resolve!: (value: EmailTemplate) => void;
  mockApiA.updateTemplate.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const { client, wrapper } = setup();
  client.setQueryData(emailKeys.templates, [template('A private')]);
  const { result, rerender } = renderHook(() => useUpdateTemplate(), { wrapper });
  let pending!: Promise<unknown>;
  act(() => {
    pending = result.current
      .mutateAsync({ templateId: 'same-id', name: 'A edit' })
      .catch((error) => error);
  });
  await waitFor(() => expect(mockApiA.updateTemplate).toHaveBeenCalled());
  const mutation = client.getMutationCache().getAll()[0];
  expect(mutation.state.context).toBeUndefined();
  expect(JSON.parse(JSON.stringify(mutation.state.variables))).toEqual({
    input: { templateId: 'same-id', name: 'A edit' },
  });
  mockCurrentApi = mockApiB;
  act(() => {
    mockEpoch++;
    for (const listener of mockListeners) listener();
    rerender();
  });
  await act(async () => {
    resolve(template('A response'));
    expect(await pending).toEqual(expect.objectContaining({ message: 'Email account changed' }));
  });
});
