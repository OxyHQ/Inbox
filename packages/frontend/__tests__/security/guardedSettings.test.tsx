import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { OxyServices } from '@oxy.so/core';
import { createInboxQueryClient, INBOX_ACCOUNT_QUERIES } from '@/hooks/queries/queryClient';
import { emailKeys } from '@/hooks/queries/queryKeys';
import { useEmailStore } from '@/hooks/useEmail';
let mockOxy: OxyServices;
let mockRuntime: ReturnType<typeof import('@oxy.so/services/runtime').useOxyRuntime>;
let mockUser = 'alice';
const mockToast = { success: jest.fn(), error: jest.fn() };
jest.mock('@oxy.so/services/runtime', () => ({ useOxyRuntime: () => mockRuntime }));
jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({ oxyServices: mockOxy, user: { id: mockUser } }),
}));
jest.mock('@oxy.so/bloom/toast', () => ({ toast: mockToast }));
jest.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: { name?: string }) => (vars?.name ? `${key}:${vars.name}` : key),
  }),
}));
jest.mock('react-native', () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock('@oxy.so/bloom/text-field', () => ({
  TextFieldInput: ({
    label,
    value,
    onChangeText,
  }: {
    label: string;
    value: string;
    onChangeText: (s: string) => void;
  }) => <input aria-label={label} value={value} onChange={(e) => onChangeText(e.target.value)} />,
}));
jest.mock('@oxy.so/bloom/textarea', () => ({
  Textarea: ({
    accessibilityLabel,
    value,
    onChangeText,
  }: {
    accessibilityLabel: string;
    value: string;
    onChangeText: (value: string) => void;
  }) => (
    <textarea
      aria-label={accessibilityLabel}
      value={value}
      onChange={(e) => onChangeText(e.target.value)}
    />
  ),
}));
jest.mock('@oxy.so/bloom/switch', () => ({ Switch: () => null }));
jest.mock('@/components/EmptyStateSticker', () => ({ EmptyStateSticker: () => null }));
jest.mock('@oxy.so/bloom/button', () => ({
  Button: ({
    children,
    onPress,
    disabled,
  }: {
    children: ReactNode;
    onPress: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" disabled={disabled} onClick={onPress}>
      {children}
    </button>
  ),
  IconButton: ({
    accessibilityLabel,
    onPress,
    disabled,
    loading,
  }: {
    accessibilityLabel: string;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
  }) => (
    <button
      type="button"
      aria-label={accessibilityLabel}
      aria-busy={loading || undefined}
      disabled={disabled}
      onClick={onPress}
    />
  ),
}));
jest.mock('@oxy.so/bloom/settings-modal', () => ({
  SettingsValueField: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  SettingsProfilePage: ({
    sections,
  }: {
    sections: {
      key: string;
      rows: { key: string; label: string; description?: string; control: ReactNode }[];
    }[];
  }) => (
    <>
      {sections.map((section) => (
        <section key={section.key}>
          {section.rows.map((row) => (
            <div key={row.key}>
              <span>{row.label}</span>
              {row.description && <p>{row.description}</p>}
              {row.control}
            </div>
          ))}
        </section>
      ))}
    </>
  ),
}));
jest.mock('@oxy.so/bloom/dialog', () => ({
  useDialogControl: () => ({ open: () => {}, close: () => {} }),
  Dialog: ({
    actions,
    description,
  }: {
    actions: { label: string; onPress?: () => void; disabled?: boolean }[];
    description?: string;
  }) => (
    <>
      <p>{description}</p>
      {actions.map((a) => (
        <button type="button" key={a.label} disabled={a.disabled} onClick={() => a.onPress?.()}>
          {a.label}
        </button>
      ))}
    </>
  ),
}));
import { AccountSection } from '@/components/settings/sections/AccountSection';
function token(user: string, session: string) {
  return `e30.${Buffer.from(JSON.stringify({ userId: user, sessionId: session, exp: 2000000000 })).toString('base64url')}.fixture`;
}
function response(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: () => 'application/json' },
    json: async () => body,
    text: async () => JSON.stringify(body),
    clone() {
      return this;
    },
  };
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
    mockRuntime.setActiveSessionId('a-session');
  });
});
afterEach(() => {
  onlineManager.setOnline(true);
  useEmailStore.getState().resetAccountScopedState();
  mockOxy.dispose();
  globalThis.fetch = previousFetch;
});
function persistenceFor(client: ReturnType<typeof createInboxQueryClient>) {
  const { dirname, join } = require('node:path');
  const dir = dirname(require.resolve('@oxy.so/services/package.json'));
  const { createAccountQueryPersistence } = require(
    join(dir, 'lib/commonjs/ui/hooks/accountQueryPersistence.js'),
  );
  const m = new Map<string, string>();
  const p = createAccountQueryPersistence(client, INBOX_ACCOUNT_QUERIES);
  p.setStorage({
    getItem: async (k: string) => m.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      m.set(k, v);
    },
    removeItem: async (k: string) => {
      m.delete(k);
    },
  });
  p.attach();
  return p;
}

function AccountControls() {
  return <AccountSection key={mockUser} />;
}
it('does not send A settings under B after a same-turn account switch', async () => {
  const sent: { bearer: string; body: string }[] = [];
  const settings = {
    signature: '',
    autoReply: { enabled: false },
    autoForwardTo: '',
    autoForwardKeepCopy: true,
  };
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      sent.push({
        bearer: new Headers(init.headers).get('authorization') ?? '',
        body: String(init.body),
      });
      return response({});
    }
    return response({ data: settings });
  }) as never;
  const client = createInboxQueryClient();
  const persistence = persistenceFor(client);
  persistence.activate('alice');
  await persistence.whenReady();
  useEmailStore.getState()._initApi(mockOxy.http);
  client.setQueryData(emailKeys.settings('alice'), settings);
  const view = render(
    <QueryClientProvider client={client}>
      <AccountControls />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText('ui.settings.account.forwarding'), {
    target: { value: 'synthetic@example.test' },
  });
  act(() => {
    fireEvent.click(screen.getByRole('button', { name: 'ui.settings.account.saveChanges' }));
    mockUser = 'bob';
    mockOxy.session.setAccessToken(token('bob', 'b-session'));
    mockRuntime.batch(() => {
      mockRuntime.setAccount({ id: 'bob' });
      mockRuntime.setActiveSessionId('b-session');
    });
    useEmailStore.getState().resetAccountScopedState();
    useEmailStore.getState()._initApi(mockOxy.http);
    persistence.activate('bob');
    view.rerender(
      <QueryClientProvider client={client}>
        <AccountControls />
      </QueryClientProvider>,
    );
  });
  await persistence.whenReady();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(sent).toEqual([]);
  view.unmount();
  persistence.detach();
  client.clear();
});

it('does not submit a retained settings draft after changing session for the same subject', async () => {
  const sent: string[] = [];
  const settings = {
    signature: '',
    autoReply: { enabled: false },
    autoForwardTo: '',
    autoForwardKeepCopy: true,
  };
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      sent.push(new Headers(init.headers).get('authorization') ?? '');
      return response({});
    }
    return response({ data: settings });
  }) as never;
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  client.setQueryData(emailKeys.settings('alice'), settings);
  const view = render(
    <QueryClientProvider client={client}>
      <AccountControls />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText('ui.settings.account.forwarding'), {
    target: { value: 'synthetic@example.test' },
  });
  act(() => {
    mockOxy.session.setAccessToken(token('alice', 'another-session'));
    mockRuntime.setActiveSessionId('another-session');
    view.rerender(
      <QueryClientProvider client={client}>
        <AccountControls />
      </QueryClientProvider>,
    );
  });
  expect(screen.getByText('ui.settings.account.draftSessionChanged')).toBeTruthy();
  const save = screen.getByRole('button', {
    name: 'ui.settings.account.saveChanges',
  }) as HTMLButtonElement;
  expect(save.disabled).toBe(true);
  fireEvent.click(save);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(sent).toEqual([]);
  expect((screen.getByLabelText('ui.settings.account.forwarding') as HTMLInputElement).value).toBe(
    'synthetic@example.test',
  );
  fireEvent.click(screen.getByRole('button', { name: 'ui.settings.account.discardDraft' }));
  expect((screen.getByLabelText('ui.settings.account.forwarding') as HTMLInputElement).value).toBe(
    '',
  );
  view.unmount();
  client.clear();
});

it('preserves the draft and suppresses late feedback when a sent save outlives the session', async () => {
  let finish!: (value: ReturnType<typeof response>) => void, begin!: () => void;
  const reply = new Promise<ReturnType<typeof response>>((resolve) => {
    finish = resolve;
  });
  const started = new Promise<void>((resolve) => {
    begin = resolve;
  });
  const sent: string[] = [];
  const settings = {
    signature: '',
    autoReply: { enabled: false },
    autoForwardTo: '',
    autoForwardKeepCopy: true,
  };
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      sent.push(new Headers(init.headers).get('authorization') ?? '');
      begin();
      return reply;
    }
    return response({ data: settings });
  }) as never;
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  client.setQueryData(emailKeys.settings('alice'), settings);
  const view = render(
    <QueryClientProvider client={client}>
      <AccountControls />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText('ui.settings.account.forwarding'), {
    target: { value: 'synthetic@example.test' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'ui.settings.account.saveChanges' }));
  await started;
  act(() => {
    mockOxy.session.setAccessToken(token('alice', 'another-session'));
    mockRuntime.setActiveSessionId('another-session');
    view.rerender(
      <QueryClientProvider client={client}>
        <AccountControls />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    finish(response({}));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(sent).toEqual([`Bearer ${token('alice', 'a-session')}`]);
  expect(mockToast.success).not.toHaveBeenCalled();
  expect(mockToast.error).not.toHaveBeenCalled();
  expect(screen.getByText('ui.settings.account.draftSessionChanged')).toBeTruthy();
  expect((screen.getByLabelText('ui.settings.account.forwarding') as HTMLInputElement).value).toBe(
    'synthetic@example.test',
  );
  view.unmount();
  client.clear();
});

it('keeps edits after an offline failure and allows an explicit same-owner retry', async () => {
  let attempts = 0;
  const settings = {
    signature: '',
    autoReply: { enabled: false },
    autoForwardTo: '',
    autoForwardKeepCopy: true,
  };
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      attempts++;
      if (attempts === 1) throw new Error('synthetic offline');
      return response({});
    }
    return response({ data: settings });
  }) as never;
  onlineManager.setOnline(false);
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  client.setQueryData(emailKeys.settings('alice'), settings);
  const view = render(
    <QueryClientProvider client={client}>
      <AccountControls />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText('ui.settings.account.forwarding'), {
    target: { value: 'synthetic@example.test' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'ui.settings.account.saveChanges' }));
  await waitFor(() => expect(mockToast.error).toHaveBeenCalledTimes(1));
  expect((screen.getByLabelText('ui.settings.account.forwarding') as HTMLInputElement).value).toBe(
    'synthetic@example.test',
  );
  expect(attempts).toBe(1);
  act(() => onlineManager.setOnline(true));
  fireEvent.click(screen.getByRole('button', { name: 'ui.settings.account.saveChanges' }));
  await waitFor(() =>
    expect(mockToast.success).toHaveBeenCalledWith('ui.settings.account.updated'),
  );
  expect(attempts).toBe(2);
  view.unmount();
  client.clear();
});

it('keeps later edits after an earlier save and refresh complete', async () => {
  let finish!: (value: ReturnType<typeof response>) => void, begin!: () => void;
  const reply = new Promise<ReturnType<typeof response>>((resolve) => {
    finish = resolve;
  });
  const started = new Promise<void>((resolve) => {
    begin = resolve;
  });
  let settings = {
    signature: '',
    autoReply: { enabled: false },
    autoForwardTo: '',
    autoForwardKeepCopy: true,
  };
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      begin();
      return reply;
    }
    return response({ data: settings });
  }) as never;
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  client.setQueryData(emailKeys.settings('alice'), settings);
  const view = render(
    <QueryClientProvider client={client}>
      <AccountControls />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText('ui.settings.account.forwarding'), {
    target: { value: 'first@example.test' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'ui.settings.account.saveChanges' }));
  await started;
  fireEvent.change(screen.getByLabelText('ui.settings.account.forwarding'), {
    target: { value: 'later@example.test' },
  });
  settings = { ...settings, autoForwardTo: 'first@example.test' };
  await act(async () => {
    finish(response({}));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await waitFor(() =>
    expect(mockToast.success).toHaveBeenCalledWith('ui.settings.account.updated'),
  );
  await waitFor(() =>
    expect(
      (client.getQueryData(emailKeys.settings('alice')) as typeof settings).autoForwardTo,
    ).toBe('first@example.test'),
  );
  expect((screen.getByLabelText('ui.settings.account.forwarding') as HTMLInputElement).value).toBe(
    'later@example.test',
  );
  expect(screen.getByRole('button', { name: 'ui.settings.account.saveChanges' })).toBeTruthy();
  view.unmount();
  client.clear();
});

it('keeps text written before API readiness until explicit discard and retry', async () => {
  const settings = {
    signature: '',
    autoReply: { enabled: false },
    autoForwardTo: '',
    autoForwardKeepCopy: true,
  };
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) =>
    init?.method === 'PUT' ? response({}) : response({ data: settings }),
  ) as never;
  const client = createInboxQueryClient();
  client.setQueryData(emailKeys.settings('alice'), settings);
  const view = render(
    <QueryClientProvider client={client}>
      <AccountControls />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText('ui.settings.account.forwarding'), {
    target: { value: 'copy@example.test' },
  });
  expect(screen.getByText('ui.settings.account.draftSessionChanged')).toBeTruthy();
  expect(
    (screen.getByRole('button', { name: 'ui.settings.account.saveChanges' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  act(() => useEmailStore.getState()._initApi(mockOxy.http));
  expect((screen.getByLabelText('ui.settings.account.forwarding') as HTMLInputElement).value).toBe(
    'copy@example.test',
  );
  fireEvent.click(screen.getByRole('button', { name: 'ui.settings.account.discardDraft' }));
  fireEvent.change(screen.getByLabelText('ui.settings.account.forwarding'), {
    target: { value: 'copy@example.test' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'ui.settings.account.saveChanges' }));
  await waitFor(() =>
    expect(mockToast.success).toHaveBeenCalledWith('ui.settings.account.updated'),
  );
  view.unmount();
  client.clear();
});

it('allows the same draft after null-to-ID projection recovery', async () => {
  let writes = 0;
  const settings = {
    signature: '',
    autoReply: { enabled: false },
    autoForwardTo: '',
    autoForwardKeepCopy: true,
  };
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      writes++;
      return response({});
    }
    return response({ data: settings });
  }) as never;
  mockRuntime.setActiveSessionId(null);
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  client.setQueryData(emailKeys.settings('alice'), settings);
  const view = render(
    <QueryClientProvider client={client}>
      <AccountControls />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText('ui.settings.account.forwarding'), {
    target: { value: 'synthetic@example.test' },
  });
  act(() => mockRuntime.setActiveSessionId('a-session'));
  expect(screen.queryByText('ui.settings.account.draftSessionChanged')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'ui.settings.account.saveChanges' }));
  await waitFor(() =>
    expect(mockToast.success).toHaveBeenCalledWith('ui.settings.account.updated'),
  );
  expect(writes).toBe(1);
  view.unmount();
  client.clear();
});

it('does not reauthorize an old draft after an observed session ABA', async () => {
  const settings = {
    signature: '',
    autoReply: { enabled: false },
    autoForwardTo: '',
    autoForwardKeepCopy: true,
  };
  globalThis.fetch = jest.fn(async () => response({ data: settings })) as never;
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  client.setQueryData(emailKeys.settings('alice'), settings);
  const view = render(
    <QueryClientProvider client={client}>
      <AccountControls />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText('ui.settings.account.forwarding'), {
    target: { value: 'synthetic@example.test' },
  });
  act(() => {
    mockOxy.session.setAccessToken(token('alice', 'another-session'));
    mockRuntime.setActiveSessionId('another-session');
  });
  act(() => {
    mockOxy.session.setAccessToken(token('alice', 'a-session'));
    mockRuntime.setActiveSessionId('a-session');
  });
  expect(screen.getByText('ui.settings.account.draftSessionChanged')).toBeTruthy();
  expect(
    (screen.getByRole('button', { name: 'ui.settings.account.saveChanges' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect((screen.getByLabelText('ui.settings.account.forwarding') as HTMLInputElement).value).toBe(
    'synthetic@example.test',
  );
  view.unmount();
  client.clear();
});

it('does not overwrite a field the user never edited when initial settings arrive late', async () => {
  let finish!: (value: ReturnType<typeof response>) => void, begin!: () => void;
  const reply = new Promise<ReturnType<typeof response>>((resolve) => {
    finish = resolve;
  });
  const started = new Promise<void>((resolve) => {
    begin = resolve;
  });
  const sent: string[] = [];
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      sent.push(String(init.body));
      return response({});
    }
    begin();
    return reply;
  }) as never;
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  const view = render(
    <QueryClientProvider client={client}>
      <AccountControls />
    </QueryClientProvider>,
  );
  await started;
  fireEvent.change(screen.getByLabelText('ui.settings.account.forwarding'), {
    target: { value: 'forward@example.test' },
  });
  expect(screen.getByText('ui.settings.account.loadingSettings')).toBeTruthy();
  expect(
    (screen.getByRole('button', { name: 'ui.settings.account.saveChanges' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(sent).toEqual([]);
  await act(async () => {
    finish(
      response({
        data: {
          signature: 'remote signature',
          autoReply: {
            enabled: true,
            subject: 'remote subject',
            body: 'remote body',
            startDate: '2030-01-01T00:00:00.000Z',
            endDate: '2030-02-01T00:00:00.000Z',
          },
          autoForwardTo: '',
          autoForwardKeepCopy: true,
        },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: 'ui.settings.account.saveChanges' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', { name: 'ui.settings.account.saveChanges' }));
  await waitFor(() => expect(sent).toHaveLength(1));
  expect(JSON.parse(sent[0])).toEqual({ autoForwardTo: 'forward@example.test' });
  view.unmount();
  client.clear();
});

it('keeps edits while settings load is offline, then enables save after reconnect', async () => {
  let gets = 0,
    writes = 0;
  const settings = {
    signature: 'remote signature',
    autoReply: { enabled: false },
    autoForwardTo: '',
    autoForwardKeepCopy: true,
  };
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      writes++;
      return response({});
    }
    gets++;
    if (gets === 1) throw new Error('synthetic offline');
    return response({ data: settings });
  }) as never;
  onlineManager.setOnline(false);
  const client = createInboxQueryClient();
  client.setDefaultOptions({
    ...client.getDefaultOptions(),
    queries: { ...client.getDefaultOptions().queries, retryDelay: 0 },
  });
  useEmailStore.getState()._initApi(mockOxy.http);
  const view = render(
    <QueryClientProvider client={client}>
      <AccountControls />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText('ui.settings.account.forwarding'), {
    target: { value: 'forward@example.test' },
  });
  await waitFor(() =>
    expect(screen.getByText('ui.settings.account.settingsUnavailable')).toBeTruthy(),
  );
  expect(
    (screen.getByRole('button', { name: 'ui.settings.account.saveChanges' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect((screen.getByLabelText('ui.settings.account.forwarding') as HTMLInputElement).value).toBe(
    'forward@example.test',
  );
  expect(writes).toBe(0);
  act(() => onlineManager.setOnline(true));
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: 'ui.settings.account.saveChanges' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  expect((screen.getByLabelText('ui.settings.account.forwarding') as HTMLInputElement).value).toBe(
    'forward@example.test',
  );
  fireEvent.click(screen.getByRole('button', { name: 'ui.settings.account.saveChanges' }));
  await waitFor(() =>
    expect(mockToast.success).toHaveBeenCalledWith('ui.settings.account.updated'),
  );
  expect(writes).toBe(1);
  view.unmount();
  client.clear();
});

it('keeps edited vacation subject and carries forward untouched body and dates', async () => {
  const sent: string[] = [];
  let settings = {
    signature: '',
    autoReply: {
      enabled: true,
      subject: 'old subject',
      body: 'old body',
      startDate: '2030-01-01T00:00:00.000Z',
      endDate: '2030-02-01T00:00:00.000Z',
    },
    autoForwardTo: '',
    autoForwardKeepCopy: true,
  };
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      sent.push(String(init.body));
      return response({});
    }
    return response({ data: settings });
  }) as never;
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  client.setQueryData(emailKeys.settings('alice'), settings);
  const view = render(
    <QueryClientProvider client={client}>
      <AccountControls />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText('ui.settings.account.subjectPlaceholder'), {
    target: { value: 'my subject' },
  });
  settings = {
    ...settings,
    autoReply: {
      ...settings.autoReply,
      body: 'new remote body',
      startDate: '2031-01-01T00:00:00.000Z',
      endDate: '2031-02-01T00:00:00.000Z',
    },
  };
  act(() => client.setQueryData(emailKeys.settings('alice'), settings));
  await waitFor(() =>
    expect(
      (screen.getByLabelText('ui.settings.account.messagePlaceholder') as HTMLTextAreaElement)
        .value,
    ).toBe('new remote body'),
  );
  expect(
    (screen.getByLabelText('ui.settings.account.subjectPlaceholder') as HTMLInputElement).value,
  ).toBe('my subject');
  fireEvent.click(screen.getByRole('button', { name: 'ui.settings.account.saveChanges' }));
  await waitFor(() => expect(sent).toHaveLength(1));
  expect(JSON.parse(sent[0])).toEqual({
    autoReply: {
      enabled: true,
      subject: 'my subject',
      body: 'new remote body',
      startDate: '2031-01-01T00:00:00.000Z',
      endDate: '2031-02-01T00:00:00.000Z',
    },
  });
  view.unmount();
  client.clear();
});

it('keeps edits and blocks save when the initial settings request fails online', async () => {
  let writes = 0;
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'PUT') writes++;
    throw new Error('synthetic read failure');
  }) as never;
  const client = createInboxQueryClient();
  client.setDefaultOptions({
    ...client.getDefaultOptions(),
    queries: { ...client.getDefaultOptions().queries, retry: 0 },
  });
  useEmailStore.getState()._initApi(mockOxy.http);
  const view = render(
    <QueryClientProvider client={client}>
      <AccountControls />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText('ui.settings.account.forwarding'), {
    target: { value: 'copy@example.test' },
  });
  await waitFor(() =>
    expect(screen.getByText('ui.settings.account.settingsUnavailable')).toBeTruthy(),
  );
  expect(
    (screen.getByRole('button', { name: 'ui.settings.account.saveChanges' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect((screen.getByLabelText('ui.settings.account.forwarding') as HTMLInputElement).value).toBe(
    'copy@example.test',
  );
  expect(writes).toBe(0);
  view.unmount();
  client.clear();
});

it('does not save if a known bearer subject differs from the projected account', async () => {
  const settings = {
    signature: '',
    autoReply: { enabled: false },
    autoForwardTo: '',
    autoForwardKeepCopy: true,
  };
  globalThis.fetch = jest.fn() as never;
  mockOxy.session.setAccessToken(token('bob', 'b-session'));
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  client.setQueryData(emailKeys.settings('alice'), settings);
  const view = render(
    <QueryClientProvider client={client}>
      <AccountControls />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText('ui.settings.account.forwarding'), {
    target: { value: 'copy@example.test' },
  });
  expect(screen.getByText('ui.settings.account.draftSessionChanged')).toBeTruthy();
  expect(
    (screen.getByRole('button', { name: 'ui.settings.account.saveChanges' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect((screen.getByLabelText('ui.settings.account.forwarding') as HTMLInputElement).value).toBe(
    'copy@example.test',
  );
  expect(globalThis.fetch).not.toHaveBeenCalled();
  view.unmount();
  client.clear();
});
