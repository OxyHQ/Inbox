import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OxyServices } from '@oxy.so/core';
import type { ReactNode } from 'react';
import type { Message } from '@/services/emailApi';

let mockOxy: OxyServices;
let mockRuntime: ReturnType<typeof import('@oxy.so/services/runtime').useOxyRuntime>;
let mockUser: string | null = 'alice';
let mockOldReply: (() => void) | undefined;
let mockOldGenerate: (() => void) | undefined;
jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({ oxyServices: mockOxy, user: mockUser ? { id: mockUser } : null }),
}));
jest.mock('@oxy.so/services/runtime', () => ({ useOxyRuntime: () => mockRuntime }));
jest.mock('@/contexts/inbox-prefs-context', () => ({
  useInboxPrefs: () => ({ prefs: { aiSmartReply: true } }),
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
    mockOldGenerate = onPress;
    return (
      <button type="button" onClick={onPress} disabled={disabled}>
        {children}
      </button>
    );
  },
}));
jest.mock('@oxy.so/bloom/chip', () => ({
  Chip: ({ children, onPress }: { children: ReactNode; onPress: () => void }) => {
    mockOldReply = onPress;
    return (
      <button type="button" onClick={onPress}>
        {children}
      </button>
    );
  },
}));
jest.mock('@oxy.so/bloom/icons/RiSparklingLine', () => ({ RiSparklingLine: () => null }));
jest.mock('@oxy.so/bloom/loading', () => ({
  Loading: ({ text }: { text: string }) => <span>{text}</span>,
}));
jest.mock('@oxy.so/bloom/typography', () => ({
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
import { SmartReplyChips } from '@/components/SmartReplyChips';

beforeEach(() => {
  mockUser = 'alice';
  mockOxy = new OxyServices({
    baseURL: 'https://api.test',
    enableRetry: false,
    enableCache: false,
  });
  mockOldReply = undefined;
  mockOldGenerate = undefined;
  mockOxy.session.setAccessToken(token('alice', 'session-a'));
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
  onlineManager.setOnline(true);
  mockOxy.dispose();
});

function token(subject: string, session: string, extra = '') {
  return `e30.${Buffer.from(JSON.stringify({ userId: subject, sessionId: session, exp: 2000000000, jti: extra })).toString('base64url')}.fixture`;
}

it('requires a fresh opt-in when the actual target message changes', async () => {
  jest.spyOn(mockOxy.http, 'post').mockResolvedValueOnce({ replies: ['Reply to first'] } as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onSelect = jest.fn();
  const wrap = (id: string) => (
    <QueryClientProvider client={client}>
      <SmartReplyChips message={{ _id: id } as Message} onSelectReply={onSelect} />
    </QueryClientProvider>
  );
  const view = render(wrap('first'));
  fireEvent.click(screen.getByRole('button', { name: 'smartReply.generate' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Reply to first' })).toBeTruthy());
  view.rerender(wrap('second'));
  expect(screen.getByRole('button', { name: 'smartReply.generate' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Reply to first' })).toBeNull();
  view.unmount();
  client.clear();
});

it('does not dispatch a retained chip callback after its target is replaced', async () => {
  jest.spyOn(mockOxy.http, 'post').mockResolvedValueOnce({ replies: ['Reply to first'] } as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onSelect = jest.fn();
  const wrap = (id: string) => (
    <QueryClientProvider client={client}>
      <SmartReplyChips message={{ _id: id } as Message} onSelectReply={onSelect} />
    </QueryClientProvider>
  );
  const view = render(wrap('first'));
  fireEvent.click(screen.getByRole('button', { name: 'smartReply.generate' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Reply to first' })).toBeTruthy());
  const oldPress = mockOldReply;
  expect(oldPress).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Reply to first' }));
  expect(onSelect).toHaveBeenCalledWith('Reply to first');
  onSelect.mockClear();
  view.rerender(wrap('second'));
  act(() => oldPress?.());
  expect(onSelect).not.toHaveBeenCalled();
  view.rerender(wrap('first'));
  act(() => oldPress?.());
  expect(onSelect).not.toHaveBeenCalled();
  view.unmount();
  client.clear();
});

it('does not start a request from a retained generate callback after target change', () => {
  const post = jest.spyOn(mockOxy.http, 'post');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = (id: string) => (
    <QueryClientProvider client={client}>
      <SmartReplyChips message={{ _id: id } as Message} onSelectReply={() => {}} />
    </QueryClientProvider>
  );
  const view = render(wrap('first'));
  const oldGenerate = mockOldGenerate;
  expect(oldGenerate).toBeDefined();
  view.rerender(wrap('second'));
  act(() => oldGenerate?.());
  expect(post).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'smartReply.generate' })).toBeTruthy();
  view.unmount();
  client.clear();
});

it('does not display an already cached reply for a different target without opt-in', async () => {
  jest.spyOn(mockOxy.http, 'post').mockResolvedValueOnce({ replies: ['Reply to first'] } as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['smartReplies', 'second'], ['Cached second reply']);
  const wrap = (id: string) => (
    <QueryClientProvider client={client}>
      <SmartReplyChips message={{ _id: id } as Message} onSelectReply={() => {}} />
    </QueryClientProvider>
  );
  const view = render(wrap('first'));
  fireEvent.click(screen.getByRole('button', { name: 'smartReply.generate' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Reply to first' })).toBeTruthy());
  view.rerender(wrap('second'));
  expect(screen.getByRole('button', { name: 'smartReply.generate' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Cached second reply' })).toBeNull();
  expect(mockOxy.http.post).toHaveBeenCalledTimes(1);
  view.unmount();
  client.clear();
});

it('does not display a late response for the previous target', async () => {
  let finish!: (value: { replies: string[] }) => void;
  const pending = new Promise<{ replies: string[] }>((resolve) => {
    finish = resolve;
  });
  jest.spyOn(mockOxy.http, 'post').mockReturnValueOnce(pending as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onSelect = jest.fn();
  const wrap = (id: string) => (
    <QueryClientProvider client={client}>
      <SmartReplyChips message={{ _id: id } as Message} onSelectReply={onSelect} />
    </QueryClientProvider>
  );
  const view = render(wrap('first'));
  fireEvent.click(screen.getByRole('button', { name: 'smartReply.generate' }));
  await waitFor(() => expect(mockOxy.http.post).toHaveBeenCalledTimes(1));
  view.rerender(wrap('second'));
  await act(async () => {
    finish({ replies: ['late reply'] });
    await pending;
  });
  expect(screen.getByRole('button', { name: 'smartReply.generate' })).toBeTruthy();
  expect(screen.queryByText('late reply')).toBeNull();
  expect(onSelect).not.toHaveBeenCalled();
  view.unmount();
  client.clear();
});

it('hides the prior session reply and rejects its retained callback through session ABA', async () => {
  jest.spyOn(mockOxy.http, 'post').mockResolvedValueOnce({ replies: ['session A reply'] } as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { INBOX_ACCOUNT_QUERIES } = require('@/hooks/queries/queryClient');
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
  const select = jest.fn();
  const wrap = () => (
    <QueryClientProvider client={client}>
      <SmartReplyChips message={{ _id: 'same' } as Message} onSelectReply={select} />
    </QueryClientProvider>
  );
  const view = render(wrap());
  fireEvent.click(screen.getByRole('button', { name: 'smartReply.generate' }));
  await waitFor(() => expect(screen.getByText('session A reply')).toBeTruthy());
  const oldQuery = client
    .getQueryCache()
    .find({ queryKey: ['smartReplies', 'same'], exact: false });
  expect(oldQuery).toBeDefined();
  expect(accountQueryOwnership(INBOX_ACCOUNT_QUERIES).ownsQuery(oldQuery)).toBe(true);
  expect(accountQueryOwnership(INBOX_ACCOUNT_QUERIES).persistsQuery(oldQuery)).toBe(false);
  expect(JSON.stringify(oldQuery?.queryKey)).not.toContain(token('alice', 'session-a'));
  const oldPress = mockOldReply;
  const oldEpoch = mockOxy.http.getSessionEpoch();
  act(() => {
    mockOxy.session.setAccessToken(token('alice', 'session-b'));
    oldPress?.();
    mockRuntime.setActiveSessionId('session-b');
    persistence.activate('alice');
    view.rerender(wrap());
  });
  expect(mockOxy.http.getSessionEpoch()).toBeGreaterThan(oldEpoch);
  expect(select).not.toHaveBeenCalled();
  expect(screen.queryByText('session A reply')).toBeNull();
  expect(oldQuery?.state.data).toEqual(['session A reply']);
  expect(screen.getByRole('button', { name: 'smartReply.generate' })).toBeTruthy();
  act(() => {
    mockOxy.session.setAccessToken(token('alice', 'session-a'));
    mockRuntime.setActiveSessionId('session-a');
    view.rerender(wrap());
    oldPress?.();
  });
  expect(select).not.toHaveBeenCalled();
  expect(screen.queryByText('session A reply')).toBeNull();
  expect(screen.getByRole('button', { name: 'smartReply.generate' })).toBeTruthy();
  view.unmount();
  persistence.detach();
  client.clear();
});

it('keeps same-session refresh and the existing reply usable', async () => {
  jest
    .spyOn(mockOxy.http, 'post')
    .mockResolvedValueOnce({ replies: ['same session reply'] } as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const select = jest.fn();
  const wrap = () => (
    <QueryClientProvider client={client}>
      <SmartReplyChips message={{ _id: 'same' } as Message} onSelectReply={select} />
    </QueryClientProvider>
  );
  const view = render(wrap());
  fireEvent.click(screen.getByRole('button', { name: 'smartReply.generate' }));
  await waitFor(() => expect(screen.getByText('same session reply')).toBeTruthy());
  const oldEpoch = mockOxy.http.getSessionEpoch();
  act(() => {
    mockOxy.session.setAccessToken(token('alice', 'session-a', 'refreshed'));
    view.rerender(wrap());
  });
  expect(mockOxy.http.getSessionEpoch()).toBe(oldEpoch);
  fireEvent.click(screen.getByRole('button', { name: 'same session reply' }));
  expect(select).toHaveBeenCalledWith('same session reply');
  view.unmount();
  client.clear();
});

it('treats a null-to-ID projection as a fresh opt-in', async () => {
  mockRuntime.setActiveSessionId(null);
  jest
    .spyOn(mockOxy.http, 'post')
    .mockResolvedValueOnce({ replies: ['unprojected reply'] } as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = () => (
    <QueryClientProvider client={client}>
      <SmartReplyChips message={{ _id: 'same' } as Message} onSelectReply={() => {}} />
    </QueryClientProvider>
  );
  const view = render(wrap());
  fireEvent.click(screen.getByRole('button', { name: 'smartReply.generate' }));
  await waitFor(() => expect(screen.getByText('unprojected reply')).toBeTruthy());
  act(() => mockRuntime.setActiveSessionId('session-a'));
  expect(screen.queryByText('unprojected reply')).toBeNull();
  expect(screen.getByRole('button', { name: 'smartReply.generate' })).toBeTruthy();
  view.unmount();
  client.clear();
});

it('aborts a delayed auth preflight when the projected session changes', async () => {
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
  const savedFetch = globalThis.fetch;
  globalThis.fetch = jest.fn() as never;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <SmartReplyChips message={{ _id: 'same' } as Message} onSelectReply={() => {}} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'smartReply.generate' }));
  await started;
  await act(async () => {
    mockRuntime.setActiveSessionId('session-b');
    await Promise.resolve();
    resume();
  });
  expect(globalThis.fetch).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'smartReply.generate' })).toBeTruthy();
  view.unmount();
  client.clear();
  globalThis.fetch = savedFetch;
});

it('does not show a late response after the session changes', async () => {
  let finish!: (value: { replies: string[] }) => void;
  const pending = new Promise<{ replies: string[] }>((resolve) => {
    finish = resolve;
  });
  jest.spyOn(mockOxy.http, 'post').mockReturnValueOnce(pending as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <SmartReplyChips message={{ _id: 'same' } as Message} onSelectReply={() => {}} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'smartReply.generate' }));
  await waitFor(() => expect(mockOxy.http.post).toHaveBeenCalledTimes(1));
  act(() => {
    mockOxy.session.setAccessToken(token('alice', 'session-b'));
    mockRuntime.setActiveSessionId('session-b');
  });
  await act(async () => {
    finish({ replies: ['late A'] });
    await pending;
  });
  expect(screen.queryByText('late A')).toBeNull();
  expect(screen.getByRole('button', { name: 'smartReply.generate' })).toBeTruthy();
  view.unmount();
  client.clear();
});

it('explains when the observed account cannot safely start a request', () => {
  mockRuntime.setAccount({ id: 'bob' });
  const post = jest.spyOn(mockOxy.http, 'post');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <SmartReplyChips message={{ _id: 'same' } as Message} onSelectReply={() => {}} />
    </QueryClientProvider>,
  );
  expect(
    (screen.getByRole('button', { name: 'smartReply.generate' }) as HTMLButtonElement).disabled,
  ).toBe(true);
  expect(screen.getByText('smartReply.unavailable')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'smartReply.generate' }));
  expect(post).not.toHaveBeenCalled();
  act(() => mockRuntime.setAccount({ id: 'alice' }));
  expect(
    (screen.getByRole('button', { name: 'smartReply.generate' }) as HTMLButtonElement).disabled,
  ).toBe(false);
  view.unmount();
  client.clear();
});

it('does not reuse an old query when the control is remounted on the same QueryClient', async () => {
  jest
    .spyOn(mockOxy.http, 'post')
    .mockResolvedValueOnce({ replies: ['old mount'] } as never)
    .mockResolvedValueOnce({ replies: ['new mount'] } as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = () => (
    <QueryClientProvider client={client}>
      <SmartReplyChips message={{ _id: 'same' } as Message} onSelectReply={() => {}} />
    </QueryClientProvider>
  );
  const first = render(wrap());
  fireEvent.click(screen.getByRole('button', { name: 'smartReply.generate' }));
  await waitFor(() => expect(screen.getByText('old mount')).toBeTruthy());
  first.unmount();
  const second = render(wrap());
  expect(screen.queryByText('old mount')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'smartReply.generate' }));
  await waitFor(() => expect(screen.getByText('new mount')).toBeTruthy());
  expect(mockOxy.http.post).toHaveBeenCalledTimes(2);
  second.unmount();
  client.clear();
});

it('does not revive a prior reply after a committed user-only ABA', async () => {
  jest.spyOn(mockOxy.http, 'post').mockResolvedValueOnce({ replies: ['old user reply'] } as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const select = jest.fn();
  const wrap = () => (
    <QueryClientProvider client={client}>
      <SmartReplyChips message={{ _id: 'same' } as Message} onSelectReply={select} />
    </QueryClientProvider>
  );
  const view = render(wrap());
  fireEvent.click(screen.getByRole('button', { name: 'smartReply.generate' }));
  await waitFor(() => expect(screen.getByText('old user reply')).toBeTruthy());
  const oldPress = mockOldReply;
  act(() => {
    mockUser = 'bob';
    view.rerender(wrap());
  });
  expect(screen.queryByText('old user reply')).toBeNull();
  expect(
    (screen.getByRole('button', { name: 'smartReply.generate' }) as HTMLButtonElement).disabled,
  ).toBe(true);
  act(() => {
    mockUser = 'alice';
    view.rerender(wrap());
    oldPress?.();
  });
  expect(select).not.toHaveBeenCalled();
  expect(screen.queryByText('old user reply')).toBeNull();
  expect(
    (screen.getByRole('button', { name: 'smartReply.generate' }) as HTMLButtonElement).disabled,
  ).toBe(false);
  view.unmount();
  client.clear();
});

it('does not reuse a prior query across QueryClient A to B to A', async () => {
  jest.spyOn(mockOxy.http, 'post').mockResolvedValueOnce({ replies: ['client A reply'] } as never);
  const clientA = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const clientB = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = (client: QueryClient) => (
    <QueryClientProvider client={client}>
      <SmartReplyChips message={{ _id: 'same' } as Message} onSelectReply={() => {}} />
    </QueryClientProvider>
  );
  const view = render(wrap(clientA));
  fireEvent.click(screen.getByRole('button', { name: 'smartReply.generate' }));
  await waitFor(() => expect(screen.getByText('client A reply')).toBeTruthy());
  view.rerender(wrap(clientB));
  expect(screen.getByRole('button', { name: 'smartReply.generate' })).toBeTruthy();
  view.rerender(wrap(clientA));
  expect(screen.queryByText('client A reply')).toBeNull();
  expect(screen.getByRole('button', { name: 'smartReply.generate' })).toBeTruthy();
  view.unmount();
  clientA.clear();
  clientB.clear();
});

it('does not reuse an earlier runtime instance with the same projected identity', async () => {
  jest
    .spyOn(mockOxy.http, 'post')
    .mockResolvedValueOnce({ replies: ['old provider reply'] } as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const select = jest.fn();
  const wrap = () => (
    <QueryClientProvider client={client}>
      <SmartReplyChips message={{ _id: 'same' } as Message} onSelectReply={select} />
    </QueryClientProvider>
  );
  const view = render(wrap());
  fireEvent.click(screen.getByRole('button', { name: 'smartReply.generate' }));
  await waitFor(() => expect(screen.getByText('old provider reply')).toBeTruthy());
  const retained = mockOldReply;
  const { dirname, join } = require('node:path');
  const dir = dirname(require.resolve('@oxy.so/services/package.json'));
  const { createOxyRuntime } = require(join(dir, 'lib/commonjs/ui/runtime/createOxyRuntime.js'));
  const replacement = createOxyRuntime({
    oxyServices: mockOxy,
    sessionClient: { getState: () => null, getDirectory: () => null, subscribe: () => () => {} },
    sessionClientHost: { setCurrentAccountId: () => {} },
    identity: null,
    onDeviceEmpty: async () => {},
    logger: () => {},
  });
  replacement.batch(() => {
    replacement.setAccount({ id: 'alice' });
    replacement.setActiveSessionId('session-a');
  });
  expect(replacement.getAccountSessionIdentity()).toEqual(mockRuntime.getAccountSessionIdentity());
  act(() => {
    mockRuntime = replacement;
    view.rerender(wrap());
  });
  act(() => retained?.());
  expect(select).not.toHaveBeenCalled();
  expect(screen.queryByText('old provider reply')).toBeNull();
  expect(screen.getByRole('button', { name: 'smartReply.generate' })).toBeTruthy();
  view.unmount();
  client.clear();
});

it('rejects a retained generate callback as soon as Core observes a new session', () => {
  const post = jest.spyOn(mockOxy.http, 'post');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <SmartReplyChips message={{ _id: 'same' } as Message} onSelectReply={() => {}} />
    </QueryClientProvider>,
  );
  const retained = mockOldGenerate;
  expect(retained).toBeDefined();
  act(() => {
    mockOxy.session.setAccessToken(token('alice', 'session-b'));
    retained?.();
  });
  expect(post).not.toHaveBeenCalled();
  view.unmount();
  client.clear();
});

it('retains compatibility with an opaque bearer while documenting that its actor is unknown', async () => {
  mockOxy.session.setAccessToken('opaque-synthetic-token');
  expect(mockOxy.session.userId).toBeNull();
  jest.spyOn(mockOxy.http, 'post').mockResolvedValueOnce({ replies: ['opaque reply'] } as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <SmartReplyChips message={{ _id: 'same' } as Message} onSelectReply={() => {}} />
    </QueryClientProvider>,
  );
  expect(
    (screen.getByRole('button', { name: 'smartReply.generate' }) as HTMLButtonElement).disabled,
  ).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'smartReply.generate' }));
  await waitFor(() => expect(screen.getByText('opaque reply')).toBeTruthy());
  view.unmount();
  client.clear();
});

it('allocates non-enumerable decimal namespaces beyond integer precision', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const counter = Symbol.for('inbox.smartReply.mountCounter.v1');
  Object.defineProperty(client, counter, {
    value: '9999999999999999999999999999999',
    writable: true,
    enumerable: false,
  });
  const wrap = () => (
    <QueryClientProvider client={client}>
      <SmartReplyChips message={{ _id: 'same' } as Message} onSelectReply={() => {}} />
    </QueryClientProvider>
  );
  const first = render(wrap());
  expect(Object.getOwnPropertyDescriptor(client, counter)?.value).toBe(
    '10000000000000000000000000000000',
  );
  expect(Object.getOwnPropertyDescriptor(client, counter)?.enumerable).toBe(false);
  first.unmount();
  const second = render(wrap());
  expect(Object.getOwnPropertyDescriptor(client, counter)?.value).toBe(
    '10000000000000000000000000000001',
  );
  second.unmount();
  client.clear();
});

it('explains a generation failure and offers a retry for the current session', async () => {
  const post = jest
    .spyOn(mockOxy.http, 'post')
    .mockRejectedValueOnce(new Error('synthetic failure'))
    .mockResolvedValueOnce({ replies: ['recovered'] } as never);
  const { createInboxQueryClient } = require('@/hooks/queries/queryClient');
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <SmartReplyChips message={{ _id: 'same' } as Message} onSelectReply={() => {}} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'smartReply.generate' }));
  await waitFor(() => expect(screen.getByText('smartReply.failed')).toBeTruthy());
  expect(post).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
  await waitFor(() => expect(screen.getByText('recovered')).toBeTruthy());
  expect(post).toHaveBeenCalledTimes(2);
  view.unmount();
  client.clear();
});

it('distinguishes a successful empty response from a generation failure', async () => {
  jest.spyOn(mockOxy.http, 'post').mockResolvedValueOnce({ replies: [] } as never);
  const { createInboxQueryClient } = require('@/hooks/queries/queryClient');
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <SmartReplyChips message={{ _id: 'same' } as Message} onSelectReply={() => {}} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'smartReply.generate' }));
  await waitFor(() => expect(screen.getByText('smartReply.empty')).toBeTruthy());
  expect(screen.queryByText('smartReply.failed')).toBeNull();
  view.unmount();
  client.clear();
});

it('explains an offline failure, then requires an explicit retry after reconnecting', async () => {
  onlineManager.setOnline(false);
  const post = jest
    .spyOn(mockOxy.http, 'post')
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ replies: ['after reconnect'] } as never);
  const { createInboxQueryClient } = require('@/hooks/queries/queryClient');
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <SmartReplyChips message={{ _id: 'same' } as Message} onSelectReply={() => {}} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'smartReply.generate' }));
  await waitFor(() => expect(screen.getByText('smartReply.offline')).toBeTruthy());
  expect((screen.getByRole('button', { name: 'common.retry' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  expect(post).toHaveBeenCalledTimes(1);
  act(() => onlineManager.setOnline(true));
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: 'common.retry' }) as HTMLButtonElement).disabled,
    ).toBe(false),
  );
  expect(post).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
  await waitFor(() => expect(screen.getByText('after reconnect')).toBeTruthy());
  expect(post).toHaveBeenCalledTimes(2);
  view.unmount();
  client.clear();
});

it('does not let a retained retry run after the observed session changes', async () => {
  const post = jest.spyOn(mockOxy.http, 'post').mockRejectedValueOnce(new Error('failure'));
  const { createInboxQueryClient } = require('@/hooks/queries/queryClient');
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <SmartReplyChips message={{ _id: 'same' } as Message} onSelectReply={() => {}} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'smartReply.generate' }));
  await waitFor(() => expect(screen.getByText('smartReply.failed')).toBeTruthy());
  const retained = mockOldGenerate;
  expect(retained).toBeDefined();
  act(() => {
    mockOxy.session.setAccessToken(token('alice', 'session-b'));
    retained?.();
    mockRuntime.setActiveSessionId('session-b');
  });
  expect(post).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'smartReply.generate' })).toBeTruthy();
  view.unmount();
  client.clear();
});

it('does not send duplicate requests from retained repeated presses', async () => {
  let finish!: (value: { replies: string[] }) => void;
  const pending = new Promise<{ replies: string[] }>((resolve) => {
    finish = resolve;
  });
  const post = jest.spyOn(mockOxy.http, 'post').mockReturnValueOnce(pending as never);
  const { createInboxQueryClient } = require('@/hooks/queries/queryClient');
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <SmartReplyChips message={{ _id: 'same' } as Message} onSelectReply={() => {}} />
    </QueryClientProvider>,
  );
  const retained = mockOldGenerate;
  expect(retained).toBeDefined();
  act(() => {
    retained?.();
    retained?.();
  });
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  await act(async () => {
    finish({ replies: ['one reply'] });
    await pending;
  });
  await waitFor(() => expect(screen.getByText('one reply')).toBeTruthy());
  view.unmount();
  client.clear();
});

it('reports a paused request and lets TanStack resume that same request after reconnecting', async () => {
  onlineManager.setOnline(false);
  const post = jest
    .spyOn(mockOxy.http, 'post')
    .mockResolvedValueOnce({ replies: ['resumed'] } as never);
  const client = new QueryClient({
    defaultOptions: { queries: { networkMode: 'online', retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <SmartReplyChips message={{ _id: 'same' } as Message} onSelectReply={() => {}} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'smartReply.generate' }));
  await waitFor(() => expect(screen.getByText('smartReply.offline')).toBeTruthy());
  expect(post).not.toHaveBeenCalled();
  expect((screen.getByRole('button', { name: 'common.retry' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  act(() => onlineManager.setOnline(true));
  await waitFor(() => expect(screen.getByText('resumed')).toBeTruthy());
  expect(post).toHaveBeenCalledTimes(1);
  view.unmount();
  client.clear();
});

it('does not replay an offline failure after switching sessions and reconnecting', async () => {
  onlineManager.setOnline(false);
  const post = jest.spyOn(mockOxy.http, 'post').mockRejectedValueOnce(new Error('offline'));
  const { createInboxQueryClient } = require('@/hooks/queries/queryClient');
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <SmartReplyChips message={{ _id: 'same' } as Message} onSelectReply={() => {}} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'smartReply.generate' }));
  await waitFor(() => expect(screen.getByText('smartReply.offline')).toBeTruthy());
  const retained = mockOldGenerate;
  act(() => {
    mockOxy.session.setAccessToken(token('alice', 'session-b'));
    mockRuntime.setActiveSessionId('session-b');
  });
  act(() => {
    onlineManager.setOnline(true);
    retained?.();
  });
  await act(async () => {
    await Promise.resolve();
  });
  expect(post).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'smartReply.generate' })).toBeTruthy();
  view.unmount();
  client.clear();
});
