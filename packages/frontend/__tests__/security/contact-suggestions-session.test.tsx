import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { OxyServices } from '@oxy.so/core';
import { type ReactNode, useState } from 'react';
import { createInboxQueryClient, INBOX_ACCOUNT_QUERIES } from '@/hooks/queries/queryClient';
import { useEmailStore } from '@/hooks/useEmail';

type Suggestion = { id: string; address: string };
let mockOxy: OxyServices;
let mockRuntime: ReturnType<typeof import('@oxy.so/services/runtime').useOxyRuntime>;
let mockPick: ((item: Suggestion) => void) | undefined;
jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({
    oxyServices: mockOxy,
    user: { id: 'alice' },
    canUsePrivateApi: true,
    isAccountCacheReady: true,
  }),
}));
jest.mock('@oxy.so/services/runtime', () => ({ useOxyRuntime: () => mockRuntime }));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native', () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock('@oxy.so/bloom/button', () => ({
  Button: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock('@oxy.so/bloom/text-field', () => ({ TextFieldInput: () => null }));
jest.mock('@oxy.so/bloom/mail-compose', () => ({
  MailRecipientField: ({
    label,
    value,
    onChangeText,
    suggestions,
    onSuggestionPress,
  }: {
    label: string;
    value: string;
    onChangeText: (v: string) => void;
    suggestions: Suggestion[];
    onSuggestionPress: (v: Suggestion) => void;
  }) => {
    if (label === 'compose.fields.to') mockPick = onSuggestionPress;
    return (
      <div>
        <input aria-label={label} value={value} onChange={(e) => onChangeText(e.target.value)} />
        {suggestions.map((s) => (
          <button key={s.id} type="button" onClick={() => onSuggestionPress(s)}>
            {s.address}
          </button>
        ))}
      </div>
    );
  },
}));
import { MailAddressFields } from '@/components/MailAddressFields';

const suggestionA = { id: 'alice@example.test', address: 'alice@example.test' };
function token(session: string) {
  return `e30.${Buffer.from(JSON.stringify({ userId: 'alice', sessionId: session, exp: 2000000000 })).toString('base64url')}.fixture`;
}
function Fields() {
  const [to, setTo] = useState('al');
  return (
    <>
      <MailAddressFields
        to={to}
        onToChange={setTo}
        cc=""
        onCcChange={() => {}}
        bcc=""
        onBccChange={() => {}}
      />
      <output>{to}</output>
    </>
  );
}
async function setup(transport = true, beforeRender?: () => void, enableCache = false) {
  mockPick = undefined;
  mockOxy = new OxyServices({
    baseURL: 'https://api.test',
    enableRetry: false,
    enableCache,
  });
  mockOxy.session.setAccessToken(token('session-a'));
  const { dirname, join } = require('node:path');
  const dir = dirname(require.resolve('@oxy.so/services/package.json'));
  const { createOxyRuntime } = require(join(dir, 'lib/commonjs/ui/runtime/createOxyRuntime.js'));
  const { createAccountQueryPersistence } = require(
    join(dir, 'lib/commonjs/ui/hooks/accountQueryPersistence.js'),
  );
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
  const get = transport
    ? jest
        .spyOn(mockOxy.http, 'get')
        .mockResolvedValue({ data: [{ name: 'Alice', address: suggestionA.address }] } as never)
    : undefined;
  useEmailStore.getState()._initApi(mockOxy.http);
  const client = createInboxQueryClient();
  const persistence = createAccountQueryPersistence(client, INBOX_ACCOUNT_QUERIES);
  persistence.setStorage({
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  });
  persistence.attach();
  persistence.activate('alice');
  await persistence.whenReady();
  const tree = () => (
    <QueryClientProvider client={client}>
      <Fields />
    </QueryClientProvider>
  );
  beforeRender?.();
  const view = render(tree());
  const change = (session: string) =>
    act(() => {
      mockOxy.session.setAccessToken(token(session));
      mockRuntime.setActiveSessionId(session);
      persistence.activate('alice');
      view.rerender(tree());
    });
  const cleanup = () => {
    view.unmount();
    persistence.detach();
    client.clear();
    useEmailStore.setState({ _api: null });
    mockOxy.dispose();
    jest.restoreAllMocks();
  };
  return { view, change, cleanup, get, client };
}
it('does not offer a prior session suggestion to the current session', async () => {
  const { view, change, cleanup, get } = await setup();
  await waitFor(() => expect(view.getByText(suggestionA.address)).toBeTruthy());
  const retained = mockPick;
  get?.mockImplementation(() => new Promise(() => {}));
  change('session-b');
  expect(view.queryByText(suggestionA.address)).toBeNull();
  act(() => retained?.(suggestionA));
  expect(view.getByText('al')).toBeTruthy();
  change('session-a');
  act(() => retained?.(suggestionA));
  expect(view.getByText('al')).toBeTruthy();
  cleanup();
});
it('allows a current suggestion, preserving manually entered text', async () => {
  const { view, cleanup } = await setup();
  await waitFor(() => expect(view.getByText(suggestionA.address)).toBeTruthy());
  fireEvent.click(view.getByText(suggestionA.address));
  expect(view.container.querySelector('output')?.textContent).toBe(`${suggestionA.address}, `);
  cleanup();
});
it('does not apply a retained suggestion after the typed address changes or unmount', async () => {
  const { view, cleanup } = await setup();
  await waitFor(() => expect(view.getByText(suggestionA.address)).toBeTruthy());
  const retained = mockPick;
  fireEvent.change(view.getByLabelText('compose.fields.to'), { target: { value: 'bob' } });
  act(() => retained?.(suggestionA));
  expect(view.getByText('bob')).toBeTruthy();
  cleanup();
  act(() => retained?.(suggestionA));
});
it('does not publish a response that returns after the session changed', async () => {
  const { view, change, cleanup, get } = await setup();
  await waitFor(() => expect(view.getByText(suggestionA.address)).toBeTruthy());
  const pending: ((v: unknown) => void)[] = [];
  get?.mockImplementation(
    () =>
      new Promise((resolve) => {
        pending.push(resolve);
      }),
  );
  fireEvent.change(view.getByLabelText('compose.fields.to'), { target: { value: 'bob' } });
  await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  change('session-b');
  await act(async () => {
    pending[0]?.({ data: [{ address: 'old@example.test' }] });
  });
  expect(view.queryByText('old@example.test')).toBeNull();
  cleanup();
});

it('aborts the real HTTP preflight before it can send a previous session request', async () => {
  let finish: (v: string) => void = () => {};
  const savedFetch = globalThis.fetch;
  const fetchSpy = jest.fn();
  globalThis.fetch = fetchSpy as never;
  const { change, cleanup } = await setup(false, () => {
    let calls = 0;
    jest.spyOn(mockOxy.http as never, 'getAuthHeader' as never).mockImplementation(
      () =>
        new Promise((resolve) => {
          if (calls++ === 0) finish = resolve;
        }) as never,
    );
  });
  await waitFor(() => expect(finish.toString()).not.toBe('() => {}'));
  change('session-b');
  await act(async () => {
    finish(`Bearer ${token('session-b')}`);
    await Promise.resolve();
  });
  expect(fetchSpy).not.toHaveBeenCalled();
  cleanup();
  globalThis.fetch = savedFetch;
});

it('keeps suggestions while typing within one observed session', async () => {
  const { view, get, cleanup } = await setup();
  await waitFor(() => expect(view.getByText(suggestionA.address)).toBeTruthy());
  get?.mockImplementation(() => new Promise(() => {}));
  fireEvent.change(view.getByLabelText('compose.fields.to'), { target: { value: 'ali' } });
  expect(view.getByText(suggestionA.address)).toBeTruthy();
  fireEvent.click(view.getByText(suggestionA.address));
  expect(view.container.querySelector('output')?.textContent).toBe(`${suggestionA.address}, `);
  cleanup();
});

it('hides suggestions if the known bearer subject differs from the projection', async () => {
  const { view, cleanup } = await setup();
  await waitFor(() => expect(view.getByText(suggestionA.address)).toBeTruthy());
  const retained = mockPick;
  const otherToken = `e30.${Buffer.from(JSON.stringify({ userId: 'bob', sessionId: 'session-b', exp: 2000000000 })).toString('base64url')}.fixture`;
  act(() => mockOxy.session.setAccessToken(otherToken));
  expect(view.queryByText(suggestionA.address)).toBeNull();
  act(() => retained?.(suggestionA));
  expect(view.getByText('al')).toBeTruthy();
  cleanup();
});

it('does not reuse a previous mount’s in-memory suggestions', async () => {
  const { view, get, client, cleanup } = await setup();
  await waitFor(() => expect(view.getByText(suggestionA.address)).toBeTruthy());
  const retained = mockPick;
  get?.mockImplementation(() => new Promise(() => {}));
  view.unmount();
  const other = render(
    <QueryClientProvider client={client}>
      <Fields />
    </QueryClientProvider>,
  );
  expect(other.queryByText(suggestionA.address)).toBeNull();
  act(() => retained?.(suggestionA));
  expect(other.getByText('al')).toBeTruthy();
  other.unmount();
  cleanup();
});

it('preserves a current suggestion across a same-session token refresh', async () => {
  const { view, cleanup } = await setup();
  await waitFor(() => expect(view.getByText(suggestionA.address)).toBeTruthy());
  const refreshed = `e30.${Buffer.from(JSON.stringify({ userId: 'alice', sessionId: 'session-a', exp: 2000000000, jti: 'refresh' })).toString('base64url')}.fixture`;
  act(() => mockOxy.session.setAccessToken(refreshed));
  expect(view.getByText(suggestionA.address)).toBeTruthy();
  fireEvent.click(view.getByText(suggestionA.address));
  expect(view.container.querySelector('output')?.textContent).toBe(`${suggestionA.address}, `);
  cleanup();
});

it('does not use an EmailApi bound to another HTTP service', async () => {
  const { view, cleanup } = await setup();
  await waitFor(() => expect(view.getByText(suggestionA.address)).toBeTruthy());
  const retained = mockPick;
  const other = new OxyServices({
    baseURL: 'https://other.test',
    enableRetry: false,
    enableCache: false,
  });
  const get = jest.spyOn(other.http, 'get');
  act(() => {
    useEmailStore.getState()._initApi(other.http);
  });
  expect(view.queryByText(suggestionA.address)).toBeNull();
  act(() => retained?.(suggestionA));
  expect(view.getByText('al')).toBeTruthy();
  expect(get).not.toHaveBeenCalled();
  cleanup();
  other.dispose();
});

// Red control: enable this test when checking the unresolved bearer/projection gap.
it.skip('does not offer a cached A contact after only the projected session changes', async () => {
  const savedFetch = globalThis.fetch;
  const fetchSpy = jest.fn(async () => ({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => ({ data: { data: [{ address: suggestionA.address }] } }),
  }));
  globalThis.fetch = fetchSpy as never;
  const { view, cleanup, client } = await setup(false, undefined, true);
  try {
    await waitFor(() => expect(view.getByText(suggestionA.address)).toBeTruthy());
    act(() => mockRuntime.setActiveSessionId('session-b'));
    await waitFor(() =>
      expect(
        client
          .getQueryCache()
          .getAll()
          .some((q) => q.queryKey[5] === 'session-b' && q.state.status === 'success'),
      ).toBe(true),
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(view.queryByText(suggestionA.address)).toBeNull();
  } finally {
    cleanup();
    globalThis.fetch = savedFetch;
  }
});
