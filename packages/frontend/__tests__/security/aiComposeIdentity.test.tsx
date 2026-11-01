import { act, renderHook, waitFor } from '@testing-library/react';
import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { OxyServices } from '@oxy.so/core';
import type { ReactNode } from 'react';
import { useEmailStore } from '@/hooks/useEmail';
import { createInboxQueryClient, INBOX_ACCOUNT_QUERIES } from '@/hooks/queries/queryClient';

let mockOxy: OxyServices;
let mockUser: string | null = 'alice';
let mockRuntime: ReturnType<typeof import('@oxy.so/services/runtime').useOxyRuntime>;
jest.mock('@oxy.so/services/runtime', () => ({ useOxyRuntime: () => mockRuntime }));
jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({ oxyServices: mockOxy, user: mockUser === null ? null : { id: mockUser } }),
}));
jest.mock('@oxy.so/bloom/toast', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
const mockTranslate = (key: string) => key;
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: mockTranslate }) }));
import { useAiCompose } from '@/hooks/mutations/useAiCompose';

function token(subject: string, session: string) {
  return `e30.${Buffer.from(JSON.stringify({ userId: subject, sessionId: session, exp: 2000000000 })).toString('base64url')}.fixture`;
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
  const directory = dirname(require.resolve('@oxy.so/services/package.json'));
  const { createOxyRuntime } = require(
    join(directory, 'lib/commonjs/ui/runtime/createOxyRuntime.js'),
  );
  mockRuntime = createOxyRuntime({
    oxyServices: mockOxy,
    sessionClient: {
      getState: () => null,
      getDirectory: () => null,
      subscribe: () => () => {},
      refreshDirectory: async () => {},
      activateContext: async () => {},
      signOutContext: async () => {},
      signOutPrincipal: async () => {},
    },
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

it('does not deliver an A stream chunk or final result after the account changes', async () => {
  let release!: (value: { done: false; value: Uint8Array }) => void;
  const next = new Promise<{ done: false; value: Uint8Array }>((resolve) => {
    release = resolve;
  });
  const encoder = new TextEncoder();
  const reader = {
    read: jest
      .fn()
      .mockResolvedValueOnce({
        done: false,
        value: encoder.encode('data: {"type":"delta","text":"first"}\n\n'),
      })
      .mockImplementationOnce(() => next)
      .mockResolvedValueOnce({
        done: false,
        value: encoder.encode('data: {"type":"done","requestId":"req_01a06477"}\n\n'),
      }),
    cancel: jest.fn(async () => undefined),
    releaseLock: jest.fn(),
  };
  const sent: string[] = [];
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    sent.push(new Headers(init?.headers).get('authorization') ?? '');
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'text/event-stream' },
      body: { getReader: () => reader },
    };
  }) as never;
  const client = createInboxQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, rerender, unmount } = renderHook(() => useAiCompose(), { wrapper });
  const onChunk = jest.fn();
  let operation!: Promise<unknown>;
  act(() => {
    operation = result.current
      .streamDraft('synthetic prompt', 'friendly', onChunk)
      .catch((error) => error);
  });
  await waitFor(() => expect(onChunk).toHaveBeenCalledWith('first'));
  act(() => {
    mockUser = 'bob';
    mockOxy.session.setAccessToken(token('bob', 'b-session'));
    mockRuntime.batch(() => {
      mockRuntime.setAccount({ id: 'bob' });
      mockRuntime.setActiveSessionId('b-session');
    });
    rerender();
  });
  let outcome: unknown;
  await act(async () => {
    release({
      done: false,
      value: encoder.encode('data: {"type":"delta","text":" sensitive"}\n\n'),
    });
    outcome = await operation;
  });
  expect(sent).toEqual([`Bearer ${token('alice', 'a-session')}`]);
  expect(onChunk.mock.calls).toEqual([['first']]);
  expect(outcome).toMatchObject({ name: 'AbortError' });
  unmount();
  client.clear();
});

function makeControlledStream() {
  let release!: (value: { done: false; value: Uint8Array }) => void;
  const next = new Promise<{ done: false; value: Uint8Array }>((resolve) => {
    release = resolve;
  });
  const encoder = new TextEncoder();
  const reader = {
    read: jest
      .fn()
      .mockResolvedValueOnce({
        done: false,
        value: encoder.encode('data: {"type":"delta","text":"first"}\n\n'),
      })
      .mockImplementationOnce(() => next)
      .mockResolvedValueOnce({
        done: false,
        value: encoder.encode('data: {"type":"done","requestId":"req_01a06477"}\n\n'),
      }),
    cancel: jest.fn(async () => undefined),
    releaseLock: jest.fn(),
  };
  globalThis.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    headers: { get: () => 'text/event-stream' },
    body: { getReader: () => reader },
  })) as never;
  return {
    reader,
    finish: () =>
      release({ done: false, value: encoder.encode('data: {"type":"delta","text":" end"}\n\n') }),
  };
}
it('aborts when the committed user changes before the runtime projection', async () => {
  const stream = makeControlledStream();
  const client = createInboxQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, rerender, unmount } = renderHook(() => useAiCompose(), { wrapper });
  const onChunk = jest.fn();
  let operation!: Promise<unknown>;
  act(() => {
    operation = result.current
      .streamDraft('synthetic prompt', 'friendly', onChunk)
      .catch((error) => error);
  });
  await waitFor(() => expect(onChunk).toHaveBeenCalledWith('first'));
  act(() => {
    mockUser = 'bob';
    rerender();
  });
  let outcome: unknown;
  await act(async () => {
    stream.finish();
    outcome = await operation;
  });
  expect(outcome).toMatchObject({ name: 'AbortError' });
  expect(onChunk.mock.calls).toEqual([['first']]);
  unmount();
  client.clear();
});
it('allows null-to-ID projection recovery without interrupting the same stream', async () => {
  mockRuntime.setActiveSessionId(null);
  const stream = makeControlledStream();
  const client = createInboxQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(() => useAiCompose(), { wrapper });
  const onChunk = jest.fn();
  let operation!: Promise<string>;
  act(() => {
    operation = result.current.streamDraft('synthetic prompt', 'friendly', onChunk);
  });
  await waitFor(() => expect(onChunk).toHaveBeenCalledWith('first'));
  act(() => mockRuntime.setActiveSessionId('a-session'));
  let answer = '';
  await act(async () => {
    stream.finish();
    answer = await operation;
  });
  expect(answer).toBe('first end');
  expect(onChunk).toHaveBeenLastCalledWith('first end');
  unmount();
  client.clear();
});
it('rejects a batched projection ABA even when the bearer never changes', async () => {
  const stream = makeControlledStream();
  const client = createInboxQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(() => useAiCompose(), { wrapper });
  const onChunk = jest.fn();
  let operation!: Promise<unknown>;
  act(() => {
    operation = result.current
      .streamDraft('synthetic prompt', 'friendly', onChunk)
      .catch((error) => error);
  });
  await waitFor(() => expect(onChunk).toHaveBeenCalledWith('first'));
  act(() =>
    mockRuntime.batch(() => {
      mockRuntime.setAccount({ id: 'bob' });
      mockRuntime.setActiveSessionId('b-session');
      mockRuntime.setAccount({ id: 'alice' });
      mockRuntime.setActiveSessionId('a-session');
    }),
  );
  let outcome: unknown;
  await act(async () => {
    stream.finish();
    outcome = await operation;
  });
  expect(outcome).toMatchObject({ name: 'AbortError' });
  expect(onChunk.mock.calls).toEqual([['first']]);
  unmount();
  client.clear();
});
it('aborts a delayed auth preflight when the projected account changes', async () => {
  let release!: () => void, begin!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    begin = resolve;
  });
  const http = mockOxy.http as unknown as { getAuthHeader: () => Promise<string | null> };
  const original = http.getAuthHeader.bind(http);
  http.getAuthHeader = async () => {
    begin();
    await gate;
    return original();
  };
  globalThis.fetch = jest.fn() as never;
  const client = createInboxQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(() => useAiCompose(), { wrapper });
  let operation!: Promise<unknown>;
  act(() => {
    operation = result.current.streamDraft('synthetic prompt').catch((error) => error);
  });
  await started;
  let outcome: unknown;
  await act(async () => {
    mockRuntime.setAccount({ id: 'bob' });
    outcome = await operation;
    release();
  });
  expect(outcome).toMatchObject({ name: 'AbortError' });
  expect(globalThis.fetch).not.toHaveBeenCalled();
  unmount();
  client.clear();
});

it('aborts a rewrite during delayed auth preflight when projection changes', async () => {
  let release!: () => void, begin!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    begin = resolve;
  });
  const http = mockOxy.http as unknown as { getAuthHeader: () => Promise<string | null> };
  const original = http.getAuthHeader.bind(http);
  http.getAuthHeader = async () => {
    begin();
    await gate;
    return original();
  };
  globalThis.fetch = jest.fn() as never;
  const client = createInboxQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(() => useAiCompose(), { wrapper });
  let operation!: Promise<unknown>;
  const owner = result.current.captureOwner();
  act(() => {
    operation = result.current.polish('synthetic text', owner).catch((error) => error);
  });
  await started;
  await act(async () => {
    mockRuntime.setAccount({ id: 'bob' });
    await operation;
    release();
  });
  expect(owner.signal.aborted).toBe(true);
  expect(globalThis.fetch).not.toHaveBeenCalled();
  owner.dispose();
  unmount();
  client.clear();
});

it('keeps rewrite operations memory-only and suppresses an obsolete failure', async () => {
  let reject!: (error: Error) => void;
  const response = new Promise<never>((_resolve, fail) => {
    reject = fail;
  });
  jest.spyOn(mockOxy.http, 'post').mockReturnValueOnce(response);
  const client = createInboxQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(() => useAiCompose(), { wrapper });
  const owner = result.current.captureOwner();
  let operation!: Promise<unknown>;
  act(() => {
    operation = result.current.polish('synthetic text', owner).catch((error) => error);
  });
  await waitFor(() => expect(mockOxy.http.post).toHaveBeenCalled());
  const mutation = client.getMutationCache().getAll()[0];
  const { dirname, join } = require('node:path');
  const directory = dirname(require.resolve('@oxy.so/services/package.json'));
  const { accountQueryOwnership } = require(
    join(directory, 'lib/commonjs/ui/hooks/accountQueryPersistence.js'),
  );
  expect(accountQueryOwnership(INBOX_ACCOUNT_QUERIES).persistsMutation(mutation)).toBe(false);
  await act(async () => {
    mockRuntime.setAccount({ id: 'bob' });
    reject(new Error('synthetic failure'));
    await operation;
  });
  expect(require('@oxy.so/bloom/toast').toast.error).not.toHaveBeenCalled();
  owner.dispose();
  unmount();
  client.clear();
});

it('retains a rewrite owner through null-to-ID recovery but invalidates committed user-only ABA', () => {
  mockRuntime.setActiveSessionId(null);
  const client = createInboxQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, rerender, unmount } = renderHook(() => useAiCompose(), { wrapper });
  const owner = result.current.captureOwner();
  act(() => mockRuntime.setActiveSessionId('a-session'));
  expect(owner.isCurrent()).toBe(true);
  expect(owner.signal.aborted).toBe(false);
  act(() => {
    mockUser = 'bob';
    rerender();
  });
  expect(owner.signal.aborted).toBe(true);
  act(() => {
    mockUser = 'alice';
    rerender();
  });
  expect(owner.isCurrent()).toBe(false);
  owner.dispose();
  unmount();
  client.clear();
});
it('releases rewrite listeners immediately on owner change and unmount', () => {
  let tokenListeners = 0;
  let projectionListeners = 0;
  const originalToken = mockOxy.http.addTokenChangeListener.bind(mockOxy.http);
  const originalProjection = mockRuntime.subscribe.bind(mockRuntime);
  jest.spyOn(mockOxy.http, 'addTokenChangeListener').mockImplementation((listener) => {
    tokenListeners++;
    const unsubscribe = originalToken(listener);
    return () => {
      tokenListeners--;
      unsubscribe();
    };
  });
  jest.spyOn(mockRuntime, 'subscribe').mockImplementation((listener) => {
    projectionListeners++;
    const unsubscribe = originalProjection(listener);
    return () => {
      projectionListeners--;
      unsubscribe();
    };
  });
  const client = createInboxQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(() => useAiCompose(), { wrapper });
  const tokenBaseline = tokenListeners;
  const projectionBaseline = projectionListeners;
  const owner = result.current.captureOwner();
  expect(tokenListeners).toBe(tokenBaseline + 1);
  expect(projectionListeners).toBe(projectionBaseline + 1);
  act(() => mockRuntime.setAccount({ id: 'bob' }));
  expect(owner.signal.aborted).toBe(true);
  expect(tokenListeners).toBe(tokenBaseline);
  expect(projectionListeners).toBe(projectionBaseline);
  unmount();
  expect(tokenListeners).toBe(0);
  expect(projectionListeners).toBe(0);
  client.clear();
});

it('releases both session listeners when an active stream unmounts in StrictMode', async () => {
  const stream = makeControlledStream();
  let tokenListeners = 0,
    projectionListeners = 0;
  const originalToken = mockOxy.http.addTokenChangeListener.bind(mockOxy.http);
  const originalProjection = mockRuntime.subscribe.bind(mockRuntime);
  jest.spyOn(mockOxy.http, 'addTokenChangeListener').mockImplementation((listener) => {
    tokenListeners++;
    const unsubscribe = originalToken(listener);
    return () => {
      tokenListeners--;
      unsubscribe();
    };
  });
  jest.spyOn(mockRuntime, 'subscribe').mockImplementation((listener) => {
    projectionListeners++;
    const unsubscribe = originalProjection(listener);
    return () => {
      projectionListeners--;
      unsubscribe();
    };
  });
  const client = createInboxQueryClient();
  const { StrictMode } = require('react');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <StrictMode>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </StrictMode>
  );
  const { result, unmount } = renderHook(() => useAiCompose(), { wrapper });
  const onChunk = jest.fn();
  let operation!: Promise<unknown>;
  act(() => {
    operation = result.current
      .streamDraft('synthetic prompt', 'friendly', onChunk)
      .catch((error) => error);
  });
  await waitFor(() => expect(onChunk).toHaveBeenCalledWith('first'));
  expect(tokenListeners).toBeGreaterThan(0);
  expect(projectionListeners).toBeGreaterThan(0);
  unmount();
  expect(tokenListeners).toBe(0);
  expect(projectionListeners).toBe(0);
  stream.finish();
  await expect(operation).resolves.toMatchObject({ name: 'AbortError' });
  expect(onChunk.mock.calls).toEqual([['first']]);
  client.clear();
});

it('allows a same-session token refresh during streaming', async () => {
  const stream = makeControlledStream();
  const client = createInboxQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(() => useAiCompose(), { wrapper });
  const onChunk = jest.fn();
  let operation!: Promise<string>;
  act(() => {
    operation = result.current.streamDraft('synthetic prompt', 'friendly', onChunk);
  });
  await waitFor(() => expect(onChunk).toHaveBeenCalledWith('first'));
  const initialEpoch = mockOxy.http.getSessionEpoch();
  const payload = Buffer.from(
    JSON.stringify({ userId: 'alice', sessionId: 'a-session', exp: 2000000001, jti: 'refreshed' }),
  ).toString('base64url');
  act(() => mockOxy.session.setAccessToken(`e30.${payload}.fixture`));
  expect(mockOxy.http.getSessionEpoch()).toBe(initialEpoch);
  let answer = '';
  await act(async () => {
    stream.finish();
    answer = await operation;
  });
  expect(answer).toBe('first end');
  unmount();
  client.clear();
});

it('does not start a retained streaming callback after unmount', async () => {
  globalThis.fetch = jest.fn() as never;
  const client = createInboxQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(() => useAiCompose(), { wrapper });
  const old = result.current.streamDraft;
  unmount();
  await expect(old('synthetic prompt')).rejects.toMatchObject({ name: 'AbortError' });
  expect(globalThis.fetch).not.toHaveBeenCalled();
  expect(require('@oxy.so/bloom/toast').toast.error).not.toHaveBeenCalled();
  client.clear();
});
it('reports an unavailable current session without starting a request', async () => {
  globalThis.fetch = jest.fn() as never;
  mockOxy.session.setAccessToken(token('bob', 'b-session'));
  const client = createInboxQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(() => useAiCompose(), { wrapper });
  await act(async () => {
    await expect(result.current.streamDraft('synthetic prompt')).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
  expect(globalThis.fetch).not.toHaveBeenCalled();
  expect(require('@oxy.so/bloom/toast').toast.error).toHaveBeenCalledWith('ai.toast.failed');
  unmount();
  client.clear();
});

it('releases operation listeners immediately on account change even if the reader ignores cancellation', async () => {
  const stream = makeControlledStream();
  let tokenListeners = 0,
    projectionListeners = 0;
  const originalToken = mockOxy.http.addTokenChangeListener.bind(mockOxy.http);
  const originalProjection = mockRuntime.subscribe.bind(mockRuntime);
  jest.spyOn(mockOxy.http, 'addTokenChangeListener').mockImplementation((listener) => {
    tokenListeners++;
    const unsubscribe = originalToken(listener);
    return () => {
      tokenListeners--;
      unsubscribe();
    };
  });
  jest.spyOn(mockRuntime, 'subscribe').mockImplementation((listener) => {
    projectionListeners++;
    const unsubscribe = originalProjection(listener);
    return () => {
      projectionListeners--;
      unsubscribe();
    };
  });
  const client = createInboxQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(() => useAiCompose(), { wrapper });
  const tokenBaseline = tokenListeners,
    projectionBaseline = projectionListeners;
  const onChunk = jest.fn();
  let operation!: Promise<unknown>;
  act(() => {
    operation = result.current
      .streamDraft('synthetic prompt', 'friendly', onChunk)
      .catch((error) => error);
  });
  await waitFor(() => expect(onChunk).toHaveBeenCalledWith('first'));
  expect(tokenListeners).toBe(tokenBaseline + 1);
  expect(projectionListeners).toBe(projectionBaseline + 1);
  act(() => {
    mockOxy.session.setAccessToken(token('bob', 'b-session'));
    mockRuntime.setAccount({ id: 'bob' });
  });
  expect(tokenListeners).toBe(tokenBaseline);
  expect(projectionListeners).toBe(projectionBaseline);
  await act(async () => {
    stream.finish();
    await expect(operation).resolves.toMatchObject({ name: 'AbortError' });
  });
  unmount();
  client.clear();
});

it('cancels a superseded stream without cancelling its replacement', async () => {
  const first = makeControlledStream();
  const fetchFirst = globalThis.fetch;
  const second = makeControlledStream();
  const fetchSecond = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = jest.fn((...args: Parameters<typeof fetch>) =>
    (requests++ === 0 ? fetchFirst : fetchSecond)(...args),
  ) as typeof fetch;
  const client = createInboxQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(() => useAiCompose(), { wrapper });
  const firstChunk = jest.fn(),
    secondChunk = jest.fn();
  let firstResult!: Promise<unknown>, secondResult!: Promise<string>;
  act(() => {
    firstResult = result.current
      .streamDraft('first', 'friendly', firstChunk)
      .catch((error) => error);
  });
  await waitFor(() => expect(firstChunk).toHaveBeenCalledWith('first'));
  act(() => {
    secondResult = result.current.streamDraft('second', 'friendly', secondChunk);
  });
  await waitFor(() => expect(secondChunk).toHaveBeenCalledWith('first'));
  await act(async () => {
    first.finish();
    await expect(firstResult).resolves.toMatchObject({ name: 'AbortError' });
  });
  let answer = '';
  await act(async () => {
    second.finish();
    answer = await secondResult;
  });
  expect(answer).toBe('first end');
  expect(firstChunk.mock.calls).toEqual([['first']]);
  expect(secondChunk).toHaveBeenLastCalledWith('first end');
  unmount();
  client.clear();
});

it('aborts an old stream when the provider supplies a different runtime and client', async () => {
  const stream = makeControlledStream();
  const client = createInboxQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, rerender, unmount } = renderHook(() => useAiCompose(), { wrapper });
  const onChunk = jest.fn();
  let operation!: Promise<unknown>;
  act(() => {
    operation = result.current
      .streamDraft('synthetic prompt', 'friendly', onChunk)
      .catch((error) => error);
  });
  await waitFor(() => expect(onChunk).toHaveBeenCalledWith('first'));
  const oldOxy = mockOxy;
  const nextOxy = new OxyServices({
    baseURL: 'https://api.test',
    enableRetry: false,
    enableCache: false,
  });
  nextOxy.session.setAccessToken(token('bob', 'b-session'));
  const { dirname, join } = require('node:path');
  const directory = dirname(require.resolve('@oxy.so/services/package.json'));
  const { createOxyRuntime } = require(
    join(directory, 'lib/commonjs/ui/runtime/createOxyRuntime.js'),
  );
  const nextRuntime = createOxyRuntime({
    oxyServices: nextOxy,
    sessionClient: { getState: () => null, getDirectory: () => null, subscribe: () => () => {} },
    sessionClientHost: { setCurrentAccountId: () => {} },
    identity: null,
    onDeviceEmpty: async () => {},
    logger: () => {},
  });
  nextRuntime.batch(() => {
    nextRuntime.setAccount({ id: 'bob' });
    nextRuntime.setActiveSessionId('b-session');
  });
  act(() => {
    mockUser = 'bob';
    mockOxy = nextOxy;
    mockRuntime = nextRuntime;
    rerender();
  });
  await act(async () => {
    stream.finish();
    await expect(operation).resolves.toMatchObject({ name: 'AbortError' });
  });
  expect(onChunk.mock.calls).toEqual([['first']]);
  unmount();
  client.clear();
  oldOxy.dispose();
});
it('invalidates a retained completion guard when the hook unmounts', async () => {
  const stream = makeControlledStream();
  const client = createInboxQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(() => useAiCompose(), { wrapper });
  let guard: (() => boolean) | undefined;
  let operation!: Promise<string>;
  act(() => {
    operation = result.current.streamDraft(
      'synthetic prompt',
      'friendly',
      undefined,
      (_text, isCurrent) => {
        guard = isCurrent;
      },
    );
  });
  await waitFor(() => expect(stream.reader.read).toHaveBeenCalledTimes(2));
  await act(async () => {
    stream.finish();
    await operation;
  });
  expect(guard?.()).toBe(true);
  unmount();
  expect(guard?.()).toBe(false);
  client.clear();
});
it('keeps a retained completion guard invalid after a committed user-only ABA', async () => {
  const stream = makeControlledStream();
  const client = createInboxQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, rerender, unmount } = renderHook(() => useAiCompose(), { wrapper });
  let guard: (() => boolean) | undefined;
  let operation!: Promise<string>;
  act(() => {
    operation = result.current.streamDraft(
      'synthetic prompt',
      'friendly',
      undefined,
      (_text, current) => {
        guard = current;
      },
    );
  });
  await waitFor(() => expect(stream.reader.read).toHaveBeenCalledTimes(2));
  await act(async () => {
    stream.finish();
    await operation;
  });
  expect(guard?.()).toBe(true);
  act(() => {
    mockUser = 'bob';
    rerender();
  });
  expect(guard?.()).toBe(false);
  act(() => {
    mockUser = 'alice';
    rerender();
  });
  expect(guard?.()).toBe(false);
  unmount();
  client.clear();
});
