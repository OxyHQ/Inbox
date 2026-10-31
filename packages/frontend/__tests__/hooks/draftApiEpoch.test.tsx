import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OxyServices } from '@oxy.so/core';
import { useEmailStore } from '@/hooks/useEmail';

const mockOxy = new OxyServices({ baseURL: 'https://identity.example', enableCache: false });
let mockUserId = 'alice';
jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({ oxyServices: mockOxy, user: { id: mockUserId } }),
}));
jest.mock('@oxy.so/bloom/toast', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import { useSaveDraft } from '@/hooks/mutations/useMessageMutations';

const token = (userId: string, version = 1) =>
  `e30.${Buffer.from(JSON.stringify({ userId, sessionId: userId, version, exp: 2000000000 })).toString('base64url')}.test`;

it('rejects a new action when bearer B arrives before the scope replaces API A', async () => {
  mockOxy.session.setAccessToken(token('alice'));
  const apiA = useEmailStore.getState()._initApi(mockOxy.http);
  const writeA = jest.spyOn(apiA, 'saveDraft').mockResolvedValue({ _id: 'a' } as never);
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  const { result, unmount } = renderHook(() => useSaveDraft(), { wrapper: Wrapper });
  await act(async () => {
    mockOxy.session.setAccessToken(token('bob'));
  });
  expect(useEmailStore.getState()._api).toBe(apiA);
  expect(mockUserId).toBe('alice');
  await act(async () => {
    await expect(result.current.mutateAsync({ text: 'private alice draft' })).rejects.toThrow(
      'Email account changed',
    );
  });
  expect(writeA).not.toHaveBeenCalled();
  unmount();
  client.clear();
  useEmailStore.getState().resetAccountScopedState();
});

it('does not rebind API A before scope B is installed, then allows B through a new API', async () => {
  mockOxy.session.setAccessToken(token('alice'));
  const apiA = useEmailStore.getState()._initApi(mockOxy.http);
  const writeA = jest.spyOn(apiA, 'saveDraft').mockResolvedValue({ _id: 'a' } as never);
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  const { result, rerender, unmount } = renderHook(() => useSaveDraft(), { wrapper: Wrapper });
  await act(async () => {
    mockOxy.session.setAccessToken(token('bob'));
  });
  expect(useEmailStore.getState()._initApi(mockOxy.http)).toBe(apiA);
  await act(async () => {
    await expect(result.current.mutateAsync({ text: 'alice' })).rejects.toThrow(
      'Email account changed',
    );
  });
  expect(writeA).not.toHaveBeenCalled();
  mockUserId = 'bob';
  let apiB!: typeof apiA;
  act(() => {
    useEmailStore.getState().resetAccountScopedState();
    apiB = useEmailStore.getState()._initApi(mockOxy.http);
    rerender();
  });
  expect(apiB).not.toBe(apiA);
  const writeB = jest.spyOn(apiB, 'saveDraft').mockResolvedValue({ _id: 'b' } as never);
  await act(async () => {
    await result.current.mutateAsync({ text: 'bob' });
  });
  expect(writeB).toHaveBeenCalledWith({ text: 'bob' });
  unmount();
  client.clear();
  useEmailStore.getState().resetAccountScopedState();
  mockUserId = 'alice';
});

it('keeps API ownership when the same session rotates its token', async () => {
  mockOxy.session.setAccessToken(token('alice'));
  const epoch = mockOxy.http.getSessionEpoch();
  const api = useEmailStore.getState()._initApi(mockOxy.http);
  const write = jest.spyOn(api, 'saveDraft').mockResolvedValue({ _id: 'a' } as never);
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  const { result, unmount } = renderHook(() => useSaveDraft(), { wrapper: Wrapper });
  await act(async () => {
    mockOxy.session.setAccessToken(token('alice', 2));
  });
  expect(mockOxy.http.getSessionEpoch()).toBe(epoch);
  expect(useEmailStore.getState()._initApi(mockOxy.http)).toBe(api);
  await act(async () => {
    await result.current.mutateAsync({ text: 'alice' });
  });
  expect(write).toHaveBeenCalledTimes(1);
  unmount();
  client.clear();
  useEmailStore.getState().resetAccountScopedState();
});

it('refuses an API initialized without a bearer', async () => {
  mockOxy.session.clear();
  const api = useEmailStore.getState()._initApi(mockOxy.http);
  const write = jest.spyOn(api, 'saveDraft').mockResolvedValue({ _id: 'a' } as never);
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  const { result, unmount } = renderHook(() => useSaveDraft(), { wrapper: Wrapper });
  await act(async () => {
    await expect(result.current.mutateAsync({ text: 'draft' })).rejects.toThrow(
      'Email account changed',
    );
  });
  expect(write).not.toHaveBeenCalled();
  unmount();
  client.clear();
  useEmailStore.getState().resetAccountScopedState();
});

it('rejects A work after a real 401 clears its bearer and B signs in', async () => {
  mockOxy.session.setAccessToken(token('alice'));
  const api = useEmailStore.getState()._initApi(mockOxy.http);
  const write = jest.spyOn(api, 'saveDraft').mockResolvedValue({ _id: 'a' } as never);
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  const { result, unmount } = renderHook(() => useSaveDraft(), { wrapper: Wrapper });
  const oldFetch = globalThis.fetch;
  globalThis.fetch = jest.fn(async () => ({
    ok: false,
    status: 401,
    statusText: 'Unauthorized',
    headers: { get: () => 'application/json' },
    json: async () => ({ error: 'expired' }),
    text: async () => '{"error":"expired"}',
  })) as typeof fetch;
  await act(async () => {
    await mockOxy.http.get('/expired', { retry: false, deduplicate: false }).catch(() => undefined);
  });
  expect(mockOxy.http.getAccessToken()).toBeNull();
  await act(async () => {
    mockOxy.session.setAccessToken(token('bob'));
  });
  await act(async () => {
    await expect(result.current.mutateAsync({ text: 'alice draft' })).rejects.toThrow(
      'Email account changed',
    );
  });
  expect(write).not.toHaveBeenCalled();
  globalThis.fetch = oldFetch;
  unmount();
  client.clear();
  useEmailStore.getState().resetAccountScopedState();
});

it('rejects an old handler after A to B to A, even if the API is reused', async () => {
  mockOxy.session.setAccessToken(token('alice'));
  const api = useEmailStore.getState()._initApi(mockOxy.http);
  const write = jest.spyOn(api, 'saveDraft').mockResolvedValue({ _id: 'a' } as never);
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  const { result, unmount } = renderHook(() => useSaveDraft(), { wrapper: Wrapper });
  const oldSave = result.current.mutateAsync;
  await act(async () => {
    mockOxy.session.setAccessToken(token('bob'));
    mockOxy.session.setAccessToken(token('alice', 2));
  });
  expect(useEmailStore.getState()._initApi(mockOxy.http)).toBe(api);
  await act(async () => {
    await expect(oldSave({ text: 'old alice draft' })).rejects.toThrow('Email account changed');
  });
  expect(write).not.toHaveBeenCalled();
  await act(async () => {
    await result.current.mutateAsync({ text: 'new alice draft' });
  });
  expect(write).toHaveBeenCalledWith({ text: 'new alice draft' });
  unmount();
  client.clear();
  useEmailStore.getState().resetAccountScopedState();
});

it('rejects an API created with bearer B while the rendered user is still A', async () => {
  mockOxy.session.setAccessToken(token('bob'));
  const api = useEmailStore.getState()._initApi(mockOxy.http);
  const write = jest.spyOn(api, 'saveDraft').mockResolvedValue({ _id: 'b' } as never);
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  const { result, rerender, unmount } = renderHook(() => useSaveDraft(), { wrapper: Wrapper });
  expect(mockUserId).toBe('alice');
  await act(async () => {
    await expect(result.current.mutateAsync({ text: 'private alice draft' })).rejects.toThrow(
      'Email account changed',
    );
  });
  expect(write).not.toHaveBeenCalled();
  mockUserId = 'bob';
  rerender();
  await act(async () => {
    await result.current.mutateAsync({ text: 'bob draft' });
  });
  expect(write).toHaveBeenCalledWith({ text: 'bob draft' });
  unmount();
  client.clear();
  useEmailStore.getState().resetAccountScopedState();
  mockUserId = 'alice';
});

it('allows new work after an opaque token rotates without changing the visible account', async () => {
  mockOxy.session.setAccessToken('opaque-first');
  expect(mockOxy.session.userId).toBeNull();
  const api = useEmailStore.getState()._initApi(mockOxy.http);
  const initialEpoch = mockOxy.http.getSessionEpoch();
  const write = jest.spyOn(api, 'saveDraft').mockResolvedValue({ _id: 'a' } as never);
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  const { result, unmount } = renderHook(() => useSaveDraft(), { wrapper: Wrapper });
  await act(async () => {
    mockOxy.session.setAccessToken('opaque-rotated');
  });
  expect(mockOxy.http.getSessionEpoch()).toBeGreaterThan(initialEpoch);
  expect(useEmailStore.getState()._initApi(mockOxy.http)).toBe(api);
  await act(async () => {
    await result.current.mutateAsync({ text: 'draft' });
  });
  expect(write).toHaveBeenCalledWith({ text: 'draft' });
  unmount();
  client.clear();
  useEmailStore.getState().resetAccountScopedState();
});

it('allows new work after the same account replaces its session', async () => {
  mockOxy.session.setAccessToken(token('alice'));
  const api = useEmailStore.getState()._initApi(mockOxy.http);
  const write = jest.spyOn(api, 'saveDraft').mockResolvedValue({ _id: 'a' } as never);
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  const { result, unmount } = renderHook(() => useSaveDraft(), { wrapper: Wrapper });
  const next = `e30.${Buffer.from(JSON.stringify({ userId: 'alice', sessionId: 'new-session', exp: 2000000000 })).toString('base64url')}.test`;
  await act(async () => {
    mockOxy.session.setAccessToken(next);
  });
  expect(useEmailStore.getState()._initApi(mockOxy.http)).toBe(api);
  await act(async () => {
    await result.current.mutateAsync({ text: 'new session' });
  });
  expect(write).toHaveBeenCalledWith({ text: 'new session' });
  unmount();
  client.clear();
  useEmailStore.getState().resetAccountScopedState();
});
