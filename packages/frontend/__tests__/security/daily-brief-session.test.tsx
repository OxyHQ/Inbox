import { act, render, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { OxyServices } from '@oxy.so/core';
import type { ReactNode } from 'react';
import { createInboxQueryClient, INBOX_ACCOUNT_QUERIES } from '@/hooks/queries/queryClient';
import { inboxLocalDayWindow } from '@/services/inboxInferenceApi';

let mockOxy: OxyServices;
let mockRuntime: ReturnType<typeof import('@oxy.so/services/runtime').useOxyRuntime>;
let mockRowPress: (() => void) | undefined;
let mockActionPress: (() => void) | undefined;
jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({
    oxyServices: mockOxy,
    user: { id: 'alice' },
    canUsePrivateApi: true,
    isAccountCacheReady: true,
  }),
}));
jest.mock('@oxy.so/services/runtime', () => ({ useOxyRuntime: () => mockRuntime }));
jest.mock('@/lib/i18n', () => ({
  useLocale: () => ({ locale: 'en' }),
  useTranslation: () => ({ t: (key: string) => key, locale: 'en' }),
}));
jest.mock('@/contexts/inbox-prefs-context', () => ({
  useInboxPrefs: () => ({ prefs: { aiBrief: true } }),
}));
jest.mock('@/hooks/queries/useMessage', () => ({ useMessage: () => ({ data: undefined }) }));
jest.mock('react-native', () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock('@oxy.so/bloom/card', () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardBody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock('@oxy.so/bloom/typography', () => ({
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
jest.mock('@oxy.so/bloom/button', () => ({
  Button: ({ children, onPress }: { children: ReactNode; onPress: () => void }) => {
    if (children === 'Ask') mockActionPress = onPress;
    return (
      <button type="button" onClick={onPress}>
        {children}
      </button>
    );
  },
}));
jest.mock('@oxy.so/bloom/mail-list', () => ({
  MailRow: ({ onPress }: { onPress: () => void }) => {
    mockRowPress = onPress;
    return (
      <button type="button" onClick={onPress}>
        row
      </button>
    );
  },
}));
import { useDailyBrief } from '@/hooks/queries/useDailyBrief';
import { DailyBrief } from '@/components/DailyBrief';

function token(session: string, jti = '') {
  return `e30.${Buffer.from(JSON.stringify({ userId: 'alice', sessionId: session, exp: 2000000000, jti })).toString('base64url')}.fixture`;
}
let savedFetch: typeof fetch;
beforeEach(() => {
  mockRowPress = undefined;
  mockActionPress = undefined;
  savedFetch = globalThis.fetch;
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
function brief() {
  return {
    schemaVersion: 1,
    requestId: 'req_brief',
    summary: 'synthetic brief',
    counts: { received: 1, unread: 1, starred: 0, earlierUnread: 0 },
    actions: [
      { label: 'Ask', prompt: 'synthetic prompt', messageIds: ['message-a'] },
      { label: 'Other', prompt: 'other', messageIds: ['message-a'] },
    ],
    items: [
      {
        messageId: 'message-a',
        section: 'needs_you',
        note: 'synthetic note',
        from: { name: 'A', address: 'a@example.com' },
        subject: 'synthetic',
        receivedAt: '2026-09-03T08:00:00.000Z',
        unread: true,
        hasAttachments: false,
      },
    ],
  };
}
async function setup() {
  const client = createInboxQueryClient();
  const { dirname, join } = require('node:path');
  const dir = dirname(require.resolve('@oxy.so/services/package.json'));
  const { createAccountQueryPersistence } = require(
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
  const key = ['daily-brief', 'alice', inboxLocalDayWindow().day, 'en', 'content-actions-v1'];
  client.setQueryData(key, brief());
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useDailyBrief({ enabled: false }), { wrapper });
  return { client, persistence, key, hook };
}
function switchSession() {
  mockOxy.session.setAccessToken(token('session-b'));
  mockRuntime.setActiveSessionId('session-b');
}

it('does not mutate the current cache with an earlier session mark-open callback', async () => {
  const { client, persistence, key, hook } = await setup();
  const retained = hook.result.current.markOpened;
  act(() => {
    switchSession();
    persistence.activate('alice');
    hook.rerender();
  });
  act(() => retained('message-a'));
  expect((client.getQueryData(key) as ReturnType<typeof brief>).items[0].unread).toBe(true);
  hook.unmount();
  persistence.detach();
  client.clear();
});
it('does not regenerate with a different bearer through an earlier session callback', async () => {
  const { client, persistence, hook } = await setup();
  const retained = hook.result.current.regenerate;
  const sent: string[] = [];
  globalThis.fetch = jest.fn(async (_url: unknown, init: RequestInit) => {
    sent.push(new Headers(init.headers).get('authorization') ?? '');
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => brief(),
    };
  }) as never;
  act(() => {
    switchSession();
    persistence.activate('alice');
    hook.rerender();
  });
  await act(async () => {
    await retained();
  });
  expect(sent).toEqual([]);
  hook.unmount();
  persistence.detach();
  client.clear();
});

it('does not open an old brief row or action after the observed session changes', async () => {
  const { client, persistence, key, hook } = await setup();
  const open = jest.fn();
  const action = jest.fn();
  const wrap = () => (
    <QueryClientProvider client={client}>
      <DailyBrief onOpenMessage={open} onAction={action} />
    </QueryClientProvider>
  );
  const view = render(wrap());
  await waitFor(() => expect(mockRowPress).toBeDefined());
  expect(mockActionPress).toBeDefined();
  const oldRow = mockRowPress;
  const oldAction = mockActionPress;
  act(() => {
    switchSession();
    persistence.activate('alice');
    hook.rerender();
    view.rerender(wrap());
  });
  // The existing subject-scoped cache remains readable; actor isolation is not provided here.
  expect(view.getByText('synthetic brief')).toBeTruthy();
  act(() => {
    oldRow?.();
    oldAction?.();
  });
  expect(open).not.toHaveBeenCalled();
  expect(action).not.toHaveBeenCalled();
  expect((client.getQueryData(key) as ReturnType<typeof brief>).items[0].unread).toBe(true);
  view.unmount();
  hook.unmount();
  persistence.detach();
  client.clear();
});

it('keeps current-session mark-open and visible row/action behavior', async () => {
  const { client, persistence, key, hook } = await setup();
  const open = jest.fn();
  const action = jest.fn();
  const view = render(
    <QueryClientProvider client={client}>
      <DailyBrief onOpenMessage={open} onAction={action} />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(mockRowPress).toBeDefined());
  act(() => {
    mockRowPress?.();
    mockActionPress?.();
  });
  expect(open).toHaveBeenCalledWith('message-a');
  expect(action).toHaveBeenCalledWith(expect.objectContaining({ label: 'Ask' }));
  expect((client.getQueryData(key) as ReturnType<typeof brief>).items[0].unread).toBe(false);
  view.unmount();
  hook.unmount();
  persistence.detach();
  client.clear();
});

it('does not revive retained callbacks after same-subject session ABA', async () => {
  const { client, persistence, key, hook } = await setup();
  const mark = hook.result.current.markOpened;
  const regenerate = hook.result.current.regenerate;
  const sent = jest.fn();
  globalThis.fetch = sent as never;
  act(() => {
    switchSession();
    hook.rerender();
  });
  act(() => {
    mockOxy.session.setAccessToken(token('session-a'));
    mockRuntime.setActiveSessionId('session-a');
    hook.rerender();
  });
  act(() => mark('message-a'));
  await expect(regenerate()).resolves.toBeUndefined();
  expect(sent).not.toHaveBeenCalled();
  expect((client.getQueryData(key) as ReturnType<typeof brief>).items[0].unread).toBe(true);
  hook.unmount();
  persistence.detach();
  client.clear();
});

it('keeps the persisted key/data and disables actions when the current projection disagrees', async () => {
  const { client, persistence, key, hook } = await setup();
  const open = jest.fn();
  const action = jest.fn();
  const view = render(
    <QueryClientProvider client={client}>
      <DailyBrief onOpenMessage={open} onAction={action} />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(mockRowPress).toBeDefined());
  const oldRow = mockRowPress;
  const { dirname, join } = require('node:path');
  const dir = dirname(require.resolve('@oxy.so/services/package.json'));
  const { accountQueryOwnership } = require(
    join(dir, 'lib/commonjs/ui/hooks/accountQueryPersistence.js'),
  );
  const before = client.getQueryData(key);
  const query = client.getQueryCache().find({ queryKey: key });
  expect(accountQueryOwnership(INBOX_ACCOUNT_QUERIES).persistsQuery(query)).toBe(true);
  act(() => {
    mockRuntime.setAccount({ id: 'bob' });
    hook.rerender();
  });
  expect(hook.result.current.actionsReady).toBe(false);
  expect(view.getByText('home.brief.sessionUnavailable')).toBeTruthy();
  act(() => oldRow?.());
  expect(open).not.toHaveBeenCalled();
  expect(client.getQueryData(key)).toBe(before);
  view.unmount();
  hook.unmount();
  persistence.detach();
  client.clear();
});

it('aborts old-session authentication preflight and does not surface its obsolete error', async () => {
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
  const sent = jest.fn();
  globalThis.fetch = sent as never;
  const client = createInboxQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useDailyBrief({ enabled: true }), { wrapper });
  await started;
  await act(async () => {
    mockRuntime.setActiveSessionId('session-b');
    await Promise.resolve();
    resume();
  });
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  expect(sent).not.toHaveBeenCalled();
  expect(hook.result.current.error).toBeNull();
  hook.unmount();
  client.clear();
});

it('does not replace the persisted cache with a late response after projection changes', async () => {
  const { client, persistence, key, hook } = await setup();
  const original = client.getQueryData(key);
  let finish!: (response: Response) => void;
  const response = new Promise<Response>((resolve) => {
    finish = resolve;
  });
  globalThis.fetch = jest.fn(() => response) as never;
  let operation!: Promise<unknown>;
  act(() => {
    operation = hook.result.current.regenerate();
  });
  await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
  act(() => mockRuntime.setActiveSessionId('session-b'));
  await act(async () => {
    finish({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ ...brief(), summary: 'late session A' }),
    } as unknown as Response);
    await operation;
  });
  expect(client.getQueryData(key)).toBe(original);
  expect(hook.result.current.error).toBeNull();
  hook.unmount();
  persistence.detach();
  client.clear();
});

it('keeps the current callback valid on a refresh of the same observed session', async () => {
  const { client, persistence, key, hook } = await setup();
  const retained = hook.result.current.markOpened;
  const epoch = mockOxy.http.getSessionEpoch();
  act(() => {
    mockOxy.session.setAccessToken(token('session-a', 'refresh'));
    hook.rerender();
  });
  expect(mockOxy.http.getSessionEpoch()).toBe(epoch);
  act(() => retained('message-a'));
  expect((client.getQueryData(key) as ReturnType<typeof brief>).items[0].unread).toBe(false);
  hook.unmount();
  persistence.detach();
  client.clear();
});

it('retires a callback captured before null-to-ID projection recovery without discarding cache', async () => {
  mockRuntime.setActiveSessionId(null);
  const { client, persistence, key, hook } = await setup();
  const old = hook.result.current.markOpened;
  const before = client.getQueryData(key);
  act(() => {
    mockRuntime.setActiveSessionId('session-a');
    hook.rerender();
  });
  act(() => old('message-a'));
  expect(client.getQueryData(key)).toBe(before);
  expect(hook.result.current.actionsReady).toBe(true);
  act(() => hook.result.current.markOpened('message-a'));
  expect((client.getQueryData(key) as ReturnType<typeof brief>).items[0].unread).toBe(false);
  hook.unmount();
  persistence.detach();
  client.clear();
});

it('explains disabled actions when a cached brief has rows but no summary text', async () => {
  const { client, persistence, key, hook } = await setup();
  client.setQueryData(key, { ...brief(), summary: '' });
  act(() => mockRuntime.setAccount({ id: 'bob' }));
  const view = render(
    <QueryClientProvider client={client}>
      <DailyBrief onOpenMessage={() => {}} onAction={() => {}} />
    </QueryClientProvider>,
  );
  expect(view.getByText('home.brief.sessionUnavailable')).toBeTruthy();
  expect(view.getByText('row')).toBeTruthy();
  view.unmount();
  hook.unmount();
  persistence.detach();
  client.clear();
});

it('continues to report a genuine failure under the current owner', async () => {
  const { client, persistence, key, hook } = await setup();
  const before = client.getQueryData(key);
  const failure = new Error('synthetic network failure');
  jest.spyOn(mockOxy.http, 'post').mockRejectedValueOnce(failure);
  await act(async () => {
    await hook.result.current.regenerate();
  });
  await waitFor(() => expect(hook.result.current.error).toBe(failure));
  expect(client.getQueryData(key)).toBe(before);
  hook.unmount();
  persistence.detach();
  client.clear();
});
