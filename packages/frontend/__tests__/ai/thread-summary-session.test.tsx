import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OxyServices } from '@oxy.so/core';
import type { ReactNode } from 'react';
import type { Message } from '@/services/emailApi';

let mockOxy: OxyServices;
let mockRuntime: ReturnType<typeof import('@oxy.so/services/runtime').useOxyRuntime>;
let mockUser = 'alice';
let mockSummarizePress: (() => void) | undefined;
let savedFetch: typeof fetch;
jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({ oxyServices: mockOxy, user: { id: mockUser } }),
}));
jest.mock('@oxy.so/services/runtime', () => ({ useOxyRuntime: () => mockRuntime }));
jest.mock('@/contexts/inbox-prefs-context', () => ({
  useInboxPrefs: () => ({ prefs: { aiThreadSummary: true } }),
}));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native', () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock('@oxy.so/bloom/button', () => ({
  Button: ({
    children,
    onPress,
    disabled,
  }: {
    children: ReactNode;
    onPress: () => void;
    disabled?: boolean;
  }) => {
    mockSummarizePress = onPress;
    return (
      <button type="button" onClick={onPress} disabled={disabled}>
        {children}
      </button>
    );
  },
}));
jest.mock('@oxy.so/bloom/accordion', () => ({
  Accordion: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionTrigger: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  AccordionContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock('@oxy.so/bloom/divider', () => ({ Divider: () => null }));
jest.mock('@oxy.so/bloom/icons/RiSparklingLine', () => ({ RiSparklingLine: () => null }));
jest.mock('@oxy.so/bloom/loading', () => ({
  Loading: ({ text }: { text: string }) => <span>{text}</span>,
}));
jest.mock('@oxy.so/bloom/typography', () => ({
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
import { ThreadSummary } from '@/components/ThreadSummary';
import { useThreadSummary } from '@/hooks/queries/useThreadSummary';
import { useObservedInferenceOwner } from '@/hooks/queries/useObservedInferenceOwner';

function token(session: string, jti = '') {
  return `e30.${Buffer.from(JSON.stringify({ userId: 'alice', sessionId: session, exp: 2000000000, jti })).toString('base64url')}.fixture`;
}
beforeEach(() => {
  savedFetch = globalThis.fetch;
  mockSummarizePress = undefined;
  mockUser = 'alice';
  mockOxy = new OxyServices({
    baseURL: 'https://api.test',
    enableRetry: false,
    enableCache: false,
  });
  mockOxy.session.setAccessToken(token('session-a'));
  const { dirname, join } = require('node:path');
  const dir = dirname(require.resolve('@oxy.so/services/package.json'));
  const { createOxyRuntime } = require(join(dir, 'lib/commonjs/ui/runtime/createOxyRuntime.js'));
  mockRuntime = createOxyRuntime({
    oxyServices: mockOxy,
    sessionClient: { getState: () => null, getDirectory: () => null, subscribe: () => () => {} },
    sessionClientHost: { setCurrentAccountId: () => {} },
    identity: null,
    onDeviceEmpty: async () => {},
    logger: () => {},
  });
  mockRuntime.batch(() => {
    mockRuntime.setAccount({ id: 'alice' });
    mockRuntime.setActiveSessionId('session-a');
  });
});
afterEach(() => {
  mockOxy.dispose();
  globalThis.fetch = savedFetch;
});

it('does not show a previous session summary after switching sessions for the same subject', async () => {
  jest.spyOn(mockOxy.http, 'post').mockResolvedValueOnce({
    summary: 'private session A summary',
    keyPoints: [],
    actionItems: [],
  } as never);
  const { INBOX_ACCOUNT_QUERIES, createInboxQueryClient } = require('@/hooks/queries/queryClient');
  const client = createInboxQueryClient();
  const { dirname, join } = require('node:path');
  const dir = dirname(require.resolve('@oxy.so/services/package.json'));
  const { createAccountQueryPersistence, accountQueryOwnership } = require(
    join(dir, 'lib/commonjs/ui/hooks/accountQueryPersistence.js'),
  );
  const persistence = createAccountQueryPersistence(client, INBOX_ACCOUNT_QUERIES);
  persistence.setStorage({
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  });
  persistence.attach();
  persistence.activate('alice');
  await persistence.whenReady();
  const wrap = () => (
    <QueryClientProvider client={client}>
      <ThreadSummary messageId="same" messages={[{ _id: 'same' } as Message]} />
    </QueryClientProvider>
  );
  const view = render(wrap());
  fireEvent.click(screen.getByRole('button', { name: 'threadSummary.summarize' }));
  await waitFor(() => expect(screen.getByText('private session A summary')).toBeTruthy());
  const query = client.getQueryCache().find({ queryKey: ['threadSummary', 'same'], exact: false });
  expect(accountQueryOwnership(INBOX_ACCOUNT_QUERIES).persistsQuery(query)).toBe(false);
  act(() => {
    mockOxy.session.setAccessToken(token('session-b'));
    mockRuntime.setActiveSessionId('session-b');
    persistence.activate('alice');
    view.rerender(wrap());
  });
  expect(screen.queryByText('private session A summary')).toBeNull();
  expect(screen.getByRole('button', { name: 'threadSummary.summarize' })).toBeTruthy();
  view.unmount();
  persistence.detach();
  client.clear();
});

it('rejects a retained summarize callback before and after session ABA', async () => {
  const post = jest.spyOn(mockOxy.http, 'post');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = () => (
    <QueryClientProvider client={client}>
      <ThreadSummary messageId="same" messages={[{ _id: 'same' } as Message]} />
    </QueryClientProvider>
  );
  const view = render(wrap());
  const retained = mockSummarizePress;
  expect(retained).toBeDefined();
  act(() => {
    mockOxy.session.setAccessToken(token('session-b'));
    retained?.();
    mockRuntime.setActiveSessionId('session-b');
  });
  expect(post).not.toHaveBeenCalled();
  act(() => {
    mockOxy.session.setAccessToken(token('session-a'));
    mockRuntime.setActiveSessionId('session-a');
  });
  act(() => retained?.());
  expect(post).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'threadSummary.summarize' })).toBeTruthy();
  view.unmount();
  client.clear();
});

it('does not display a delayed previous-session result', async () => {
  let finish!: (value: { summary: string; keyPoints: string[]; actionItems: unknown[] }) => void;
  const response = new Promise<{ summary: string; keyPoints: string[]; actionItems: unknown[] }>(
    (resolve) => {
      finish = resolve;
    },
  );
  const post = jest.spyOn(mockOxy.http, 'post').mockReturnValueOnce(response as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <ThreadSummary messageId="same" messages={[{ _id: 'same' } as Message]} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'threadSummary.summarize' }));
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  act(() => {
    mockOxy.session.setAccessToken(token('session-b'));
    mockRuntime.setActiveSessionId('session-b');
  });
  await act(async () => {
    finish({ summary: 'late A', keyPoints: [], actionItems: [] });
    await response;
  });
  expect(screen.queryByText('late A')).toBeNull();
  expect(screen.getByRole('button', { name: 'threadSummary.summarize' })).toBeTruthy();
  expect(post).toHaveBeenCalledTimes(1);
  view.unmount();
  client.clear();
});

it('aborts a pending authentication preflight when the projected session changes', async () => {
  let resume!: () => void, begin!: () => void;
  const gate = new Promise<void>((resolve) => {
    resume = resolve;
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
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <ThreadSummary messageId="same" messages={[{ _id: 'same' } as Message]} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'threadSummary.summarize' }));
  await started;
  await act(async () => {
    mockRuntime.setActiveSessionId('session-b');
    await Promise.resolve();
    resume();
  });
  expect(globalThis.fetch).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'threadSummary.summarize' })).toBeTruthy();
  view.unmount();
  client.clear();
});

it('retains a summary across a refresh of the same observed session', async () => {
  const post = jest
    .spyOn(mockOxy.http, 'post')
    .mockResolvedValueOnce({ summary: 'same session', keyPoints: [], actionItems: [] } as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <ThreadSummary messageId="same" messages={[{ _id: 'same' } as Message]} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'threadSummary.summarize' }));
  await waitFor(() => expect(screen.getByText('same session')).toBeTruthy());
  const epoch = mockOxy.http.getSessionEpoch();
  act(() => mockOxy.session.setAccessToken(token('session-a', 'refreshed')));
  expect(mockOxy.http.getSessionEpoch()).toBe(epoch);
  expect(screen.getByText('same session')).toBeTruthy();
  expect(post).toHaveBeenCalledTimes(1);
  view.unmount();
  client.clear();
});

it('requires a new opt-in on null-to-ID projection recovery', async () => {
  mockRuntime.setActiveSessionId(null);
  jest
    .spyOn(mockOxy.http, 'post')
    .mockResolvedValueOnce({ summary: 'unprojected', keyPoints: [], actionItems: [] } as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <ThreadSummary messageId="same" messages={[{ _id: 'same' } as Message]} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'threadSummary.summarize' }));
  await waitFor(() => expect(screen.getByText('unprojected')).toBeTruthy());
  act(() => mockRuntime.setActiveSessionId('session-a'));
  expect(screen.queryByText('unprojected')).toBeNull();
  expect(screen.getByRole('button', { name: 'threadSummary.summarize' })).toBeTruthy();
  view.unmount();
  client.clear();
});

it('explains when the current projected account cannot start a summary', () => {
  mockRuntime.setAccount({ id: 'bob' });
  const post = jest.spyOn(mockOxy.http, 'post');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <ThreadSummary messageId="same" messages={[{ _id: 'same' } as Message]} />
    </QueryClientProvider>,
  );
  expect(
    (screen.getByRole('button', { name: 'threadSummary.summarize' }) as HTMLButtonElement).disabled,
  ).toBe(true);
  expect(screen.getByText('threadSummary.accountUnavailable')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'threadSummary.summarize' }));
  expect(post).not.toHaveBeenCalled();
  act(() => mockRuntime.setAccount({ id: 'alice' }));
  expect(
    (screen.getByRole('button', { name: 'threadSummary.summarize' }) as HTMLButtonElement).disabled,
  ).toBe(false);
  view.unmount();
  client.clear();
});

it('requires a new opt-in after reopening in the same session', async () => {
  const post = jest
    .spyOn(mockOxy.http, 'post')
    .mockResolvedValueOnce({ summary: 'first summary', keyPoints: [], actionItems: [] } as never)
    .mockResolvedValueOnce({ summary: 'new summary', keyPoints: [], actionItems: [] } as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = () => (
    <QueryClientProvider client={client}>
      <ThreadSummary messageId="same" messages={[{ _id: 'same' } as Message]} />
    </QueryClientProvider>
  );
  const first = render(wrap());
  fireEvent.click(screen.getByRole('button', { name: 'threadSummary.summarize' }));
  await waitFor(() => expect(screen.getByText('first summary')).toBeTruthy());
  first.unmount();
  const second = render(wrap());
  expect(screen.queryByText('first summary')).toBeNull();
  expect(post).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'threadSummary.summarize' }));
  await waitFor(() => expect(screen.getByText('new summary')).toBeTruthy());
  expect(post).toHaveBeenCalledTimes(2);
  second.unmount();
  client.clear();
});

it('does not revive a retained action after a committed user-only ABA', () => {
  const post = jest.spyOn(mockOxy.http, 'post');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = () => (
    <QueryClientProvider client={client}>
      <ThreadSummary messageId="same" messages={[{ _id: 'same' } as Message]} />
    </QueryClientProvider>
  );
  const view = render(wrap());
  const oldPress = mockSummarizePress;
  act(() => {
    mockUser = 'bob';
    view.rerender(wrap());
  });
  expect(
    (screen.getByRole('button', { name: 'threadSummary.summarize' }) as HTMLButtonElement).disabled,
  ).toBe(true);
  act(() => {
    mockUser = 'alice';
    view.rerender(wrap());
  });
  act(() => oldPress?.());
  expect(post).not.toHaveBeenCalled();
  expect(
    (screen.getByRole('button', { name: 'threadSummary.summarize' }) as HTMLButtonElement).disabled,
  ).toBe(false);
  view.unmount();
  client.clear();
});

it('retains compatibility with an opaque bearer without claiming its actor', async () => {
  mockOxy.session.setAccessToken('opaque-synthetic-token');
  expect(mockOxy.session.userId).toBeNull();
  const post = jest
    .spyOn(mockOxy.http, 'post')
    .mockResolvedValueOnce({ summary: 'opaque summary', keyPoints: [], actionItems: [] } as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <ThreadSummary messageId="same" messages={[{ _id: 'same' } as Message]} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'threadSummary.summarize' }));
  await waitFor(() => expect(screen.getByText('opaque summary')).toBeTruthy());
  expect(post).toHaveBeenCalledTimes(1);
  view.unmount();
  client.clear();
});

it('releases request listeners immediately when an old transport ignores cancellation', async () => {
  let finish!: (value: { summary: string; keyPoints: string[]; actionItems: unknown[] }) => void;
  const pending = new Promise<{ summary: string; keyPoints: string[]; actionItems: unknown[] }>(
    (resolve) => {
      finish = resolve;
    },
  );
  const post = jest.spyOn(mockOxy.http, 'post').mockReturnValueOnce(pending as never);
  let tokenListeners = 0,
    runtimeListeners = 0;
  const originalToken = mockOxy.http.addTokenChangeListener.bind(mockOxy.http);
  const originalRuntime = mockRuntime.subscribe.bind(mockRuntime);
  jest.spyOn(mockOxy.http, 'addTokenChangeListener').mockImplementation((listener) => {
    tokenListeners++;
    const off = originalToken(listener);
    return () => {
      tokenListeners--;
      off();
    };
  });
  jest.spyOn(mockRuntime, 'subscribe').mockImplementation((listener) => {
    runtimeListeners++;
    const off = originalRuntime(listener);
    return () => {
      runtimeListeners--;
      off();
    };
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <ThreadSummary messageId="same" messages={[{ _id: 'same' } as Message]} />
    </QueryClientProvider>,
  );
  const tokenBaseline = tokenListeners,
    runtimeBaseline = runtimeListeners;
  fireEvent.click(screen.getByRole('button', { name: 'threadSummary.summarize' }));
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  expect(tokenListeners).toBe(tokenBaseline + 1);
  expect(runtimeListeners).toBe(runtimeBaseline + 1);
  act(() => mockRuntime.setActiveSessionId('session-b'));
  expect(tokenListeners).toBe(tokenBaseline);
  expect(runtimeListeners).toBe(runtimeBaseline);
  await act(async () => {
    finish({ summary: 'late A', keyPoints: [], actionItems: [] });
    await pending;
  });
  expect(screen.queryByText('late A')).toBeNull();
  view.unmount();
  expect(tokenListeners).toBe(0);
  expect(runtimeListeners).toBe(0);
  client.clear();
});

it('does not let a retained refetch start a request after its hook unmounts', async () => {
  const post = jest.spyOn(mockOxy.http, 'post');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(
    () => {
      const owner = useObservedInferenceOwner();
      return useThreadSummary('same', [{ _id: 'same' } as Message], owner, { enabled: false });
    },
    { wrapper },
  );
  const retained = result.current.refetch;
  unmount();
  await expect(retained()).resolves.toBeUndefined();
  expect(post).not.toHaveBeenCalled();
  client.clear();
});

it('does not revive a retained refetch after a committed user-only ABA', async () => {
  const post = jest.spyOn(mockOxy.http, 'post');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(
    () => {
      const owner = useObservedInferenceOwner();
      return useThreadSummary('same', [{ _id: 'same' } as Message], owner, { enabled: false });
    },
    { wrapper },
  );
  const retained = hook.result.current.refetch;
  act(() => {
    mockUser = 'bob';
    hook.rerender();
  });
  act(() => {
    mockUser = 'alice';
    hook.rerender();
  });
  await expect(retained()).resolves.toBeUndefined();
  expect(post).not.toHaveBeenCalled();
  hook.unmount();
  client.clear();
});

it('does not expose cached data through a still-mounted hook after user-only ABA', async () => {
  const post = jest
    .spyOn(mockOxy.http, 'post')
    .mockResolvedValueOnce({ summary: 'hook A summary', keyPoints: [], actionItems: [] } as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(
    () => {
      const owner = useObservedInferenceOwner();
      return useThreadSummary('same', [{ _id: 'same' } as Message], owner, { enabled: false });
    },
    { wrapper },
  );
  await act(async () => {
    await hook.result.current.refetch();
  });
  await waitFor(() => expect(hook.result.current.summary).toBe('hook A summary'));
  const oldRefetch = hook.result.current.refetch;
  act(() => {
    mockUser = 'bob';
    hook.rerender();
  });
  expect(hook.result.current.summary).toBe('');
  act(() => {
    mockUser = 'alice';
    hook.rerender();
  });
  expect(hook.result.current.summary).toBe('');
  await expect(oldRefetch()).resolves.toBeUndefined();
  expect(post).toHaveBeenCalledTimes(1);
  hook.unmount();
  client.clear();
});
