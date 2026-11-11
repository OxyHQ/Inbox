import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { dehydrate, onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { OxyServices } from '@oxy.so/core';
import { createContext, type ReactNode, startTransition, StrictMode, Suspense } from 'react';
import { createInboxQueryClient, INBOX_ACCOUNT_QUERIES } from '@/hooks/queries/queryClient';

let mockOxy: OxyServices;
let mockRuntime: ReturnType<typeof import('@oxy.so/services/runtime').useOxyRuntime>;
const mockRuntimeContext = createContext<typeof mockRuntime | null>(null);
let mockOptions: Record<string, unknown>;
let mockSubmit: (() => void) | undefined;
let mockChange: ((text: string) => void) | undefined;
jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({ oxyServices: mockOxy, user: { id: 'alice' } }),
}));
jest.mock('@oxy.so/services/runtime', () => ({
  useOxyRuntime: () => require('react').useContext(mockRuntimeContext) ?? mockRuntime,
}));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native', () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  StyleSheet: { create: (styles: unknown) => styles },
}));
jest.mock('@oxy.so/bloom/list', () => ({
  VirtualList: ({ ListHeaderComponent }: { ListHeaderComponent: ReactNode }) => (
    <div>{ListHeaderComponent}</div>
  ),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useIsFocused: () => true,
}));
jest.mock('@oxy.so/bloom/screen', () => ({
  Screen: ({ header, children }: { header: ReactNode; children: ReactNode }) => (
    <div>
      {header}
      {children}
    </div>
  ),
}));
jest.mock('@oxy.so/bloom/divider', () => ({ Divider: () => null }));
jest.mock('@oxy.so/bloom/button', () => ({
  Button: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
  IconButton: () => null,
}));
jest.mock('@oxy.so/bloom/empty-state', () => ({ EmptyState: () => null }));
jest.mock('@oxy.so/bloom/icons/RiCloseLine', () => ({ RiCloseLine: () => null }));
jest.mock('@oxy.so/bloom/loading', () => ({ Loading: () => <div>loading</div> }));
jest.mock('@oxy.so/bloom/typography', () => ({
  Text: ({
    children,
    accessibilityLiveRegion,
  }: {
    children: ReactNode;
    accessibilityLiveRegion?: string;
  }) => <span aria-live={accessibilityLiveRegion}>{children}</span>,
}));
jest.mock('@/components/SearchHeader', () => ({
  SearchHeader: require('react').forwardRef(
    (
      {
        value,
        onChangeText,
        onSubmitEditing,
      }: { value: string; onChangeText: (text: string) => void; onSubmitEditing: () => void },
      ref: unknown,
    ) => {
      mockSubmit = onSubmitEditing;
      mockChange = onChangeText;
      return (
        <input
          ref={ref as never}
          aria-label="search"
          value={value}
          onChange={(e) => onChangeText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmitEditing();
          }}
        />
      );
    },
  ),
}));
jest.mock('@/components/SearchFiltersBar', () => ({ SearchFiltersBar: () => null }));
jest.mock('@/components/SavedSearchBar', () => ({ SavedSearchBar: () => null }));
jest.mock('@/components/EmptyStateSticker', () => ({ EmptyStateSticker: () => null }));
jest.mock('@/components/MessageRow', () => ({ MessageRow: () => null }));
jest.mock('@/components/UnreadableMessageRow', () => ({ UnreadableMessageRow: () => null }));
jest.mock('@/contexts/search-focus-context', () => ({
  useSearchFocus: () => ({ registerInput: () => {} }),
}));
jest.mock('@/hooks/useGoBack', () => ({ useGoBack: () => () => {} }));
jest.mock('@oxy.so/bloom/scroll', () => ({ useScrollRestoration: () => ({}) }));
jest.mock('@/hooks/queries/useLabels', () => ({ useLabels: () => ({ data: [] }) }));
jest.mock('@/hooks/queries/useMailboxes', () => ({ useMailboxes: () => ({ data: [] }) }));
jest.mock('@/hooks/queries/useSearchMessages', () => ({
  useSearchMessages: (options: Record<string, unknown>) => {
    mockOptions = options;
    return {
      data: undefined,
      isLoading: false,
      isError: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      refetch: jest.fn(),
    };
  },
}));
jest.mock('@/hooks/useInboxDisplayPrefs', () => ({
  useInboxDisplayPrefs: () => ({ density: 'comfortable', showPreviews: true }),
}));
jest.mock('@/hooks/useMessageActions', () => ({
  useMessageActions: () => ({ prepareOpenMessage: () => {} }),
}));
jest.mock('@/hooks/useRecentSearches', () => ({
  useRecentSearches: () => ({ recentSearches: [], remember: () => {}, clear: () => {} }),
}));
jest.mock('@/constants/theme', () => ({
  useColors: () => ({ unread: '', surface: '', secondaryText: '', primary: '', border: '' }),
}));
jest.mock('@/utils/inboxTelemetry', () => ({ recordInboxMetric: () => {} }));
import { SearchList } from '@/components/SearchList';
import { SearchSessionProvider } from '@/contexts/search-session-context';

function token(session: string) {
  return `e30.${Buffer.from(JSON.stringify({ userId: 'alice', sessionId: session, exp: 2000000000 })).toString('base64url')}.fixture`;
}
async function setup(strict = false) {
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
  const pending: ((value: unknown) => void)[] = [];
  const post = jest.spyOn(mockOxy.http, 'post').mockImplementation(
    () =>
      new Promise((resolve) => {
        pending.push(resolve);
      }),
  );
  const client = createInboxQueryClient();
  const content = () => (
    <QueryClientProvider client={client}>
      <SearchSessionProvider>
        <SearchList />
      </SearchSessionProvider>
    </QueryClientProvider>
  );
  const tree = () => (strict ? <StrictMode>{content()}</StrictMode> : content());
  const view = render(tree());
  const input = view.getByLabelText('search') as HTMLInputElement;
  const submit = async (text = 'project discussion') => {
    fireEvent.change(input, { target: { value: text } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(post).toHaveBeenCalled());
  };
  const change = (session: string) =>
    act(() => {
      mockOxy.session.setAccessToken(token(session));
      mockRuntime.setActiveSessionId(session);
      view.rerender(tree());
    });
  const cleanup = () => {
    view.unmount();
    client.clear();
    mockOxy.dispose();
    jest.restoreAllMocks();
  };
  return { view, input, client, post, pending, tree, submit, change, cleanup };
}

it('does not apply a prior session natural-language search after a session switch', async () => {
  const { view, input, post, pending, submit, change, cleanup } = await setup();
  await submit();
  const options = post.mock.calls[0][2] as { signal?: AbortSignal };
  expect(options.signal?.aborted).toBe(false);
  change('session-b');
  expect(options.signal?.aborted).toBe(true);
  expect(input.value).toBe('project discussion');
  expect(view.queryByText('loading')).toBeNull();
  await act(async () => {
    pending[0]({
      query: { from: 'private@example.test' },
      interpretation: 'private interpretation',
    });
  });
  expect(view.queryByText('private interpretation')).toBeNull();
  expect(mockOptions.from).toBeUndefined();
  cleanup();
});

it('applies a natural-language result in the current session', async () => {
  const { view, pending, submit, cleanup } = await setup();
  await submit();
  await act(async () => {
    pending[0]({ query: { from: 'alice@example.test' }, interpretation: 'current result' });
  });
  await waitFor(() => expect(view.getByText('current result')).toBeTruthy());
  expect(mockOptions.from).toBe('alice@example.test');
  cleanup();
});

it('does not revive the A result after A to B to A', async () => {
  const { view, pending, submit, change, cleanup } = await setup();
  await submit();
  change('session-b');
  change('session-a');
  await act(async () => {
    pending[0]({ query: { from: 'private@example.test' }, interpretation: 'old result' });
  });
  expect(view.queryByText('old result')).toBeNull();
  expect(mockOptions.from).toBeUndefined();
  cleanup();
});

it('keeps parsing through a same-session token refresh', async () => {
  const { view, pending, submit, cleanup } = await setup();
  await submit();
  const refreshed = `e30.${Buffer.from(JSON.stringify({ userId: 'alice', sessionId: 'session-a', exp: 2000000000, jti: 'refresh' })).toString('base64url')}.fixture`;
  act(() => mockOxy.session.setAccessToken(refreshed));
  await act(async () => {
    pending[0]({ query: { from: 'alice@example.test' }, interpretation: 'current result' });
  });
  await waitFor(() => expect(view.getByText('current result')).toBeTruthy());
  cleanup();
});

it('retires a pending parse when the projected session becomes known', async () => {
  const { view, pending, submit, cleanup } = await setup();
  act(() => mockRuntime.setActiveSessionId(null));
  await submit();
  act(() => mockRuntime.setActiveSessionId('session-a'));
  await act(async () => {
    pending[0]({ query: { from: 'private@example.test' }, interpretation: 'old result' });
  });
  expect(view.queryByText('old result')).toBeNull();
  expect(mockOptions.from).toBeUndefined();
  cleanup();
});

// Red control: the existing subject-scoped search session does not isolate completed data.
it.skip('does not show an already completed interpretation after a same-subject session switch', async () => {
  const { view, pending, submit, change, cleanup } = await setup();
  await submit();
  await act(async () => {
    pending[0]({
      query: { from: 'private@example.test' },
      interpretation: 'private interpretation',
    });
  });
  await waitFor(() => expect(view.getByText('private interpretation')).toBeTruthy());
  change('session-b');
  expect(view.queryByText('private interpretation')).toBeNull();
  cleanup();
});

it('keeps plain text search and explains unavailable AI for the current session', async () => {
  const { view, input, post, cleanup } = await setup();
  const mismatch = `e30.${Buffer.from(JSON.stringify({ userId: 'bob', sessionId: 'session-b', exp: 2000000000 })).toString('base64url')}.fixture`;
  act(() => mockOxy.session.setAccessToken(mismatch));
  fireEvent.change(input, { target: { value: 'project discussion' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(view.getByText('search.nl.aiUnavailable')).toBeTruthy());
  expect(view.getByText('search.nl.aiUnavailable').getAttribute('aria-live')).toBe('polite');
  expect(mockOptions.q).toBe('project discussion');
  expect(post).not.toHaveBeenCalled();
  cleanup();
});

it('does not let retained A submit or edit callbacks overwrite a newer B search', async () => {
  const { view, input, post, change, cleanup } = await setup();
  fireEvent.change(input, { target: { value: 'alpha discussion' } });
  const oldSubmit = mockSubmit;
  const oldChange = mockChange;
  change('session-b');
  fireEvent.change(input, { target: { value: 'beta discussion' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  expect(mockOptions.q).toBe('beta discussion');
  act(() => {
    oldChange?.('old text');
    oldSubmit?.();
  });
  expect(input.value).toBe('beta discussion');
  expect(mockOptions.q).toBe('beta discussion');
  expect(post).toHaveBeenCalledTimes(1);
  expect(view.queryByText('search.nl.aiUnavailable')).toBeNull();
  cleanup();
});

it('rejects a retained A parse after runtime replacement A to B to A', async () => {
  const { view, post, pending, submit, tree, cleanup } = await setup();
  await submit();
  const options = post.mock.calls[0][2] as { signal?: AbortSignal };
  const oldRuntime = mockRuntime;
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
  view.rerender(tree());
  expect(options.signal?.aborted).toBe(true);
  mockRuntime = oldRuntime;
  view.rerender(tree());
  await act(async () => {
    pending[0]({ query: { from: 'old@example.test' }, interpretation: 'old result' });
  });
  expect(view.queryByText('old result')).toBeNull();
  expect(mockOptions.from).toBeUndefined();
  cleanup();
});

it('keeps plain search if parsing fails offline without replaying it on reconnect', async () => {
  const { view, post, submit, cleanup } = await setup();
  post.mockRejectedValueOnce(new Error('offline'));
  act(() => onlineManager.setOnline(false));
  await submit();
  await waitFor(() => expect(view.getByText('search.nl.searchingFor')).toBeTruthy());
  expect(mockOptions.q).toBe('project discussion');
  act(() => onlineManager.setOnline(true));
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(post).toHaveBeenCalledTimes(1);
  cleanup();
});

it('aborts a pending parse on unmount', async () => {
  const { view, post, pending, submit, cleanup } = await setup();
  await submit();
  const options = post.mock.calls[0][2] as { signal?: AbortSignal };
  view.unmount();
  expect(options.signal?.aborted).toBe(true);
  await act(async () => {
    pending[0]({ query: { from: 'private@example.test' }, interpretation: 'old result' });
  });
  cleanup();
});

it('does not persist the live AI mutation or serialize its owner', async () => {
  const { client, submit, cleanup } = await setup();
  await submit();
  const mutation = client.getMutationCache().getAll()[0];
  const { dirname, join } = require('node:path');
  const dir = dirname(require.resolve('@oxy.so/services/package.json'));
  const { accountQueryOwnership } = require(
    join(dir, 'lib/commonjs/ui/hooks/accountQueryPersistence.js'),
  );
  expect(accountQueryOwnership(INBOX_ACCOUNT_QUERIES).persistsMutation(mutation)).toBe(false);
  const forced = JSON.stringify(dehydrate(client, { shouldDehydrateMutation: () => true }));
  expect(forced).not.toContain(token('session-a'));
  expect(forced).not.toContain('AbortController');
  cleanup();
});

it('aborts Core preflight before an old-session AI request can be sent', async () => {
  const { view, input, post, change, cleanup } = await setup();
  post.mockRestore();
  const savedFetch = globalThis.fetch;
  const fetchSpy = jest.fn();
  globalThis.fetch = fetchSpy as never;
  let release: (header: string) => void = () => {};
  const header = jest.spyOn(mockOxy.http as never, 'getAuthHeader' as never).mockImplementation(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }) as never,
  );
  try {
    fireEvent.change(input, { target: { value: 'project discussion' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(header).toHaveBeenCalled());
    change('session-b');
    await act(async () => {
      release(`Bearer ${token('session-b')}`);
      await Promise.resolve();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(view.queryByText('search.nl.aiUnavailable')).toBeNull();
  } finally {
    cleanup();
    globalThis.fetch = savedFetch;
  }
});

it('keeps a committed parse active while a replacement runtime render suspends', async () => {
  const { view, client, post, pending, cleanup } = await setup();
  view.unmount();
  const oldRuntime = mockRuntime;
  const never = new Promise(() => {});
  function Gate({ waiting }: { waiting: boolean }) {
    if (waiting) throw never;
    return null;
  }
  const tree = (waiting: boolean, runtime: typeof mockRuntime) => (
    <mockRuntimeContext.Provider value={runtime}>
      <QueryClientProvider client={client}>
        <SearchSessionProvider>
          <Suspense fallback={<div>suspended</div>}>
            <SearchList />
            <Gate waiting={waiting} />
          </Suspense>
        </SearchSessionProvider>
      </QueryClientProvider>
    </mockRuntimeContext.Provider>
  );
  const current = render(tree(false, oldRuntime));
  const input = current.getByLabelText('search');
  fireEvent.change(input, { target: { value: 'project discussion' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
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
  act(() => startTransition(() => current.rerender(tree(true, mockRuntime))));
  expect(current.queryByText('suspended')).toBeNull();
  await act(async () => {
    pending[0]({ query: { from: 'alice@example.test' }, interpretation: 'current result' });
  });
  await waitFor(() => expect(current.getByText('current result')).toBeTruthy());
  current.unmount();
  mockRuntime = oldRuntime;
  cleanup();
});

it('parses a new search after StrictMode effect replay', async () => {
  const { view, pending, submit, cleanup } = await setup(true);
  await submit();
  await act(async () => {
    pending[0]({ query: { from: 'alice@example.test' }, interpretation: 'current result' });
  });
  await waitFor(() => expect(view.getByText('current result')).toBeTruthy());
  cleanup();
});

it('does not run an A typing debounce after the observed session changes', async () => {
  jest.useFakeTimers();
  const { input, post, change, cleanup } = await setup();
  try {
    fireEvent.change(input, { target: { value: 'alpha discussion' } });
    change('session-b');
    act(() => jest.advanceTimersByTime(301));
    expect(input.value).toBe('alpha discussion');
    expect(mockOptions.q).toBeUndefined();
    expect(post).not.toHaveBeenCalled();
  } finally {
    cleanup();
    jest.useRealTimers();
  }
});

it('does not clear a completed B interpretation when an older A parse fails late', async () => {
  const { view, input, post, pending, submit, change, cleanup } = await setup();
  let failA: (error: Error) => void = () => {};
  post.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        failA = reject;
      }),
  );
  await submit('alpha discussion');
  change('session-b');
  fireEvent.change(input, { target: { value: 'beta discussion' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
  await act(async () => {
    pending[0]({ query: { from: 'b@example.test' }, interpretation: 'current B result' });
  });
  await waitFor(() => expect(view.getByText('current B result')).toBeTruthy());
  await act(async () => {
    failA(new Error('old failure'));
  });
  expect(view.getByText('current B result')).toBeTruthy();
  expect(mockOptions.from).toBe('b@example.test');
  cleanup();
});
