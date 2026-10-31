import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { OxyServices } from '@oxy.so/core';

const mockOxy = new OxyServices({ baseURL: 'https://identity.example', enableCache: false });
const mockSend = jest.fn();
const mockSave = jest.fn();
const mockDiscard = jest.fn();
const mockApi = { getSettings: jest.fn(), sendMessage: mockSend };
const mockTranslate = (key: string) => key;
const mockToast = Object.assign(jest.fn(), {
  success: jest.fn(),
  error: jest.fn(),
  warning: jest.fn(),
  dismiss: jest.fn(),
});
const mockStorage = new Map<string, string>();
const token = `e30.${Buffer.from(JSON.stringify({ userId: 'u1', sessionId: 's1', exp: 2000000000 })).toString('base64url')}.test`;

jest.mock('@/hooks/useEmail', () => ({
  useEmailStore: Object.assign((selector: (s: unknown) => unknown) => selector({ _api: mockApi }), {
    getState: () => ({ _api: mockApi }),
  }),
}));
jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({ user: { id: 'u1', username: 'nate' }, oxyServices: mockOxy }),
}));
jest.mock('@/hooks/mutations/useMessageMutations', () => ({
  useSendMessageWithUndo: jest.requireActual('@/hooks/mutations/useMessageMutations')
    .useSendMessageWithUndo,
  useSendMessage: () => ({ mutate: jest.fn(), isPending: false }),
  useSaveDraft: () => ({ mutateAsync: mockSave }),
  useDiscardDraft: () => ({ mutateAsync: mockDiscard }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: mockTranslate }) }));
jest.mock('@oxy.so/bloom/toast', () => ({ toast: mockToast }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: async (key: string) => mockStorage.get(key) ?? null,
    setItem: async (key: string, value: string) => void mockStorage.set(key, value),
    removeItem: async (key: string) => void mockStorage.delete(key),
  },
}));

import { useComposeSession } from '@/hooks/useComposeSession';

beforeEach(() => {
  mockSave.mockReset();
  mockSend.mockReset();
  mockApi.getSettings.mockReset();
});

it('can retry after an undo-window send is abandoned by opaque token rotation', async () => {
  jest.useFakeTimers();
  mockStorage.clear();
  mockOxy.session.setAccessToken(token);
  mockApi.getSettings.mockResolvedValue({ signature: '' });
  mockSave.mockResolvedValue({ _id: 'draft', draftRevision: 1 });
  mockSend.mockResolvedValue({ message: 'accepted' });
  const client = new QueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  const options = {
    recoveryIdentity: 'new',
    awaitingReplyHeaders: false,
    insertSignature: false,
    onFinished: jest.fn(),
    initial: { to: 'ann@example.com', subject: 'Plan' },
  };
  const { result, unmount } = renderHook(() => useComposeSession(options), { wrapper: Wrapper });
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
  await act(async () => {
    await result.current.send();
  });
  expect(result.current.sending).toBe(true);
  await act(async () => {
    mockOxy.session.setAccessToken('opaque-rotated');
    await Promise.resolve();
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(5000);
  });
  expect(mockSend).not.toHaveBeenCalled();
  await act(async () => {
    await result.current.send();
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(5000);
  });
  expect(mockSend).toHaveBeenCalledTimes(1);
  unmount();
  client.clear();
  jest.useRealTimers();
});

it('unlocks the composer when the session changes while the pre-send draft save is pending', async () => {
  jest.useFakeTimers();
  mockStorage.clear();
  mockOxy.session.setAccessToken(token);
  mockApi.getSettings.mockResolvedValue({ signature: '' });
  let finishSave!: (value: unknown) => void;
  mockSave.mockReturnValueOnce(
    new Promise((resolve) => {
      finishSave = resolve;
    }),
  );
  mockSave.mockResolvedValue({ _id: 'draft', draftRevision: 1 });
  mockSend.mockResolvedValue({ message: 'accepted' });
  const client = new QueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  const options = {
    recoveryIdentity: 'new',
    awaitingReplyHeaders: false,
    insertSignature: false,
    onFinished: jest.fn(),
    initial: { to: 'ann@example.com' },
  };
  const { result, unmount } = renderHook(() => useComposeSession(options), { wrapper: Wrapper });
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
  act(() => result.current.setSubject('unsaved'));
  let first!: Promise<void>;
  act(() => {
    first = result.current.send();
  });
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
  expect(mockSave).toHaveBeenCalled();
  act(() => {
    mockOxy.session.setAccessToken('opaque-rotated');
  });
  await act(async () => {
    finishSave({ _id: 'draft', draftRevision: 1 });
    await first;
  });
  expect(mockSend).not.toHaveBeenCalled();
  await act(async () => {
    await result.current.send();
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(5000);
  });
  expect(mockSend).toHaveBeenCalledTimes(1);
  unmount();
  client.clear();
  jest.useRealTimers();
});

it('resumes local recovery after a save fails and the undo window is abandoned', async () => {
  jest.useFakeTimers();
  mockStorage.clear();
  window.localStorage.clear();
  mockOxy.session.setAccessToken(token);
  mockApi.getSettings.mockResolvedValue({ signature: '' });
  mockSave.mockRejectedValue(new Error('offline'));
  const client = new QueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  const options = {
    recoveryIdentity: 'new',
    awaitingReplyHeaders: false,
    insertSignature: false,
    onFinished: jest.fn(),
    initial: { to: 'ann@example.com' },
  };
  const { result, unmount } = renderHook(() => useComposeSession(options), { wrapper: Wrapper });
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
  act(() => result.current.setSubject('recover me'));
  await act(async () => {
    await result.current.send();
  });
  await act(async () => {
    mockOxy.session.setAccessToken('opaque-rotated');
    await Promise.resolve();
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(800);
  });
  const { composeRecoveryStorageKey, loadComposeRecovery } = await import(
    '@/utils/composeRecovery'
  );
  const recovery = await loadComposeRecovery(composeRecoveryStorageKey('u1', 'new'));
  expect(recovery?.snapshot.subject).toBe('recover me');
  expect(mockSend).not.toHaveBeenCalled();
  unmount();
  client.clear();
  jest.useRealTimers();
});

it('does not recreate recovery after logout abandons a waiting send', async () => {
  jest.useFakeTimers();
  mockStorage.clear();
  mockOxy.session.setAccessToken(token);
  mockApi.getSettings.mockResolvedValue({ signature: '' });
  mockSave.mockRejectedValue(new Error('offline'));
  const client = new QueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  const options = {
    recoveryIdentity: 'new',
    awaitingReplyHeaders: false,
    insertSignature: false,
    onFinished: jest.fn(),
    initial: { to: 'ann@example.com' },
  };
  const { result, unmount } = renderHook(() => useComposeSession(options), { wrapper: Wrapper });
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
  act(() => result.current.setSubject('private draft'));
  await act(async () => {
    await result.current.send();
  });
  const { composeRecoveryStorageKey, clearComposeRecovery, loadComposeRecovery } = await import(
    '@/utils/composeRecovery'
  );
  const key = composeRecoveryStorageKey('u1', 'new');
  await clearComposeRecovery(key);
  await act(async () => {
    mockOxy.session.clear();
    await Promise.resolve();
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1000);
  });
  expect(await loadComposeRecovery(key)).toBeNull();
  unmount();
  client.clear();
  jest.useRealTimers();
});

it('reuses the same idempotency key when a sent request is abandoned and retried', async () => {
  jest.useFakeTimers();
  mockStorage.clear();
  mockOxy.session.setAccessToken(token);
  mockApi.getSettings.mockResolvedValue({ signature: '' });
  mockSave.mockResolvedValue({ _id: 'draft', draftRevision: 1 });
  let finishFirst!: (value: unknown) => void;
  mockSend.mockReturnValueOnce(
    new Promise((resolve) => {
      finishFirst = resolve;
    }),
  );
  mockSend.mockResolvedValueOnce({ message: 'accepted' });
  const client = new QueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  const options = {
    recoveryIdentity: 'new',
    awaitingReplyHeaders: false,
    insertSignature: false,
    onFinished: jest.fn(),
    initial: { to: 'ann@example.com', subject: 'Plan' },
  };
  const { result, unmount } = renderHook(() => useComposeSession(options), { wrapper: Wrapper });
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
  await act(async () => {
    await result.current.send();
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(5000);
  });
  expect(mockSend).toHaveBeenCalledTimes(1);
  await act(async () => {
    mockOxy.session.setAccessToken('opaque-rotated');
    await Promise.resolve();
  });
  await act(async () => {
    await result.current.send();
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(5000);
  });
  expect(mockSend).toHaveBeenCalledTimes(2);
  expect(mockSend.mock.calls[1][0].idempotencyKey).toBe(mockSend.mock.calls[0][0].idempotencyKey);
  await act(async () => {
    finishFirst({ message: 'accepted earlier' });
    await Promise.resolve();
  });
  unmount();
  client.clear();
  jest.useRealTimers();
});

it('releases the session listener when the composer unmounts during a request', async () => {
  jest.useFakeTimers();
  mockStorage.clear();
  mockOxy.session.setAccessToken(token);
  mockApi.getSettings.mockResolvedValue({ signature: '' });
  mockSave.mockResolvedValue({ _id: 'draft', draftRevision: 1 });
  let finish!: (value: unknown) => void;
  mockSend.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const releases: jest.Mock[] = [];
  const original = mockOxy.http.addTokenChangeListener.bind(mockOxy.http);
  const spy = jest.spyOn(mockOxy.http, 'addTokenChangeListener').mockImplementation((listener) => {
    const remove = original(listener);
    const release = jest.fn(remove);
    releases.push(release);
    return release;
  });
  try {
    const client = new QueryClient();
    function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const options = {
      recoveryIdentity: 'new',
      awaitingReplyHeaders: false,
      insertSignature: false,
      onFinished: jest.fn(),
      initial: { to: 'ann@example.com', subject: 'Plan' },
    };
    const { result, unmount } = renderHook(() => useComposeSession(options), { wrapper: Wrapper });
    await act(async () => {
      for (let i = 0; i < 10; i++) await Promise.resolve();
    });
    await act(async () => {
      await result.current.send();
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5000);
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
    unmount();
    expect(releases.length).toBeGreaterThanOrEqual(2);
    expect(releases.every((release) => release.mock.calls.length === 1)).toBe(true);
    await act(async () => {
      finish({ message: 'accepted' });
      await Promise.resolve();
    });
    client.clear();
  } finally {
    spy.mockRestore();
    jest.useRealTimers();
  }
});

it('keeps local recovery when the bearer disappears without ending the session', async () => {
  jest.useFakeTimers();
  mockStorage.clear();
  mockOxy.session.setAccessToken(token);
  mockApi.getSettings.mockResolvedValue({ signature: '' });
  mockSave.mockRejectedValue(new Error('offline'));
  const client = new QueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  const options = {
    recoveryIdentity: 'new',
    awaitingReplyHeaders: false,
    insertSignature: false,
    onFinished: jest.fn(),
    initial: { to: 'ann@example.com' },
  };
  const { result, unmount } = renderHook(() => useComposeSession(options), { wrapper: Wrapper });
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
  act(() => result.current.setSubject('offline draft'));
  await act(async () => {
    mockOxy.http.clearTokens();
    await Promise.resolve();
  });
  expect(mockOxy.http.getAccessToken()).toBeNull();
  expect(mockOxy.http.hasSessionEnded()).toBe(false);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(800);
  });
  const { composeRecoveryStorageKey, loadComposeRecovery } = await import(
    '@/utils/composeRecovery'
  );
  const recovery = await loadComposeRecovery(composeRecoveryStorageKey('u1', 'new'));
  expect(recovery?.snapshot.subject).toBe('offline draft');
  unmount();
  client.clear();
  jest.useRealTimers();
});

it('does not recreate a deleted recovery after logout and fast same-user login', async () => {
  jest.useFakeTimers();
  mockStorage.clear();
  mockOxy.session.setAccessToken(token);
  mockApi.getSettings.mockResolvedValue({ signature: '' });
  mockSave.mockRejectedValue(new Error('offline'));
  const client = new QueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  const options = {
    recoveryIdentity: 'new',
    awaitingReplyHeaders: false,
    insertSignature: false,
    onFinished: jest.fn(),
    initial: { to: 'ann@example.com' },
  };
  const { result, unmount } = renderHook(() => useComposeSession(options), { wrapper: Wrapper });
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
  act(() => result.current.setSubject('old private draft'));
  await act(async () => {
    await result.current.send();
  });
  const { composeRecoveryStorageKey, clearComposeRecovery, loadComposeRecovery } = await import(
    '@/utils/composeRecovery'
  );
  const key = composeRecoveryStorageKey('u1', 'new');
  await clearComposeRecovery(key);
  await act(async () => {
    mockOxy.session.clear();
    mockOxy.session.setAccessToken(token);
    await Promise.resolve();
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1000);
  });
  expect(await loadComposeRecovery(key)).toBeNull();
  unmount();
  client.clear();
  jest.useRealTimers();
});

it('does not save A recovery after a bearer transition A to B to A', async () => {
  jest.useFakeTimers();
  mockStorage.clear();
  mockOxy.session.setAccessToken(token);
  mockApi.getSettings.mockResolvedValue({ signature: '' });
  mockSave.mockRejectedValue(new Error('offline'));
  const client = new QueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  const options = {
    recoveryIdentity: 'new',
    awaitingReplyHeaders: false,
    insertSignature: false,
    onFinished: jest.fn(),
    initial: { to: 'ann@example.com' },
  };
  const { result, unmount } = renderHook(() => useComposeSession(options), { wrapper: Wrapper });
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
  act(() => result.current.setSubject('old private draft'));
  await act(async () => {
    await result.current.send();
  });
  const { composeRecoveryStorageKey, clearComposeRecovery, loadComposeRecovery } = await import(
    '@/utils/composeRecovery'
  );
  const key = composeRecoveryStorageKey('u1', 'new');
  await clearComposeRecovery(key);
  const otherToken = `e30.${Buffer.from(JSON.stringify({ userId: 'u2', sessionId: 's2', exp: 2000000000 })).toString('base64url')}.test`;
  await act(async () => {
    mockOxy.session.setAccessToken(otherToken);
    mockOxy.session.setAccessToken(token);
    await Promise.resolve();
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1000);
  });
  expect(await loadComposeRecovery(key)).toBeNull();
  unmount();
  client.clear();
  jest.useRealTimers();
});
