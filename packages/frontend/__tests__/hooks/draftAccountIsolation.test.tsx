import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { dirname, join } from 'node:path';
import { INBOX_ACCOUNT_QUERIES } from '@/hooks/queries/queryClient';

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
  scope.activate('B');
  // These hooks are unregistered on Services 13.12.1: the record itself is
  // still present until the separate memory-only mutation option is adopted.
  expect(client.getMutationCache().getAll()).toHaveLength(1);
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
