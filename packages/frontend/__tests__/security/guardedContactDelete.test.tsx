import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { OxyServices } from '@oxy.so/core';
import { createInboxQueryClient, INBOX_ACCOUNT_QUERIES } from '@/hooks/queries/queryClient';
import { emailKeys } from '@/hooks/queries/queryKeys';
import { useEmailStore } from '@/hooks/useEmail';
import { wireContact } from '../fixtures/wire';
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
jest.mock('@oxy.so/bloom/textarea', () => ({ Textarea: () => null }));
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
let mockDeferDialogAction = false;
let mockRetainedDialogAction: (() => void) | undefined;
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
        <button
          type="button"
          key={a.label}
          disabled={a.disabled}
          onClick={() => {
            if (mockDeferDialogAction) mockRetainedDialogAction = a.onPress;
            else a.onPress?.();
          }}
        >
          {a.label}
        </button>
      ))}
    </>
  ),
}));
import { ContactsSection } from '@/components/settings/sections/ContactsSection';
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
function page(owner: string) {
  return {
    pages: [
      {
        data: [
          wireContact({
            _id: 'shared-contact',
            id: 'shared-contact',
            userId: owner,
            name: `${owner} synthetic`,
          }),
        ],
        pagination: { total: 1, limit: 100, offset: 0, hasMore: false },
      },
    ],
    pageParams: [0],
  };
}
let previousFetch: typeof fetch;
beforeEach(() => {
  jest.clearAllMocks();
  mockDeferDialogAction = false;
  mockRetainedDialogAction = undefined;
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
function ScopedContacts() {
  return <ContactsSection key={mockUser} />;
}
it('does not modify B contacts or send under B when A deletion waits in cancellation', async () => {
  let release!: () => void, start!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const started = new Promise<void>((r) => {
    start = r;
  });
  const sent: string[] = [];
  let cacheAtDelete: unknown;
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'DELETE') {
      sent.push(new Headers(init?.headers).get('authorization') ?? '');
      cacheAtDelete = client.getQueryData(emailKeys.contacts.list(undefined));
      return response({});
    }
    return response(page(mockUser).pages[0]);
  }) as never;
  const client = createInboxQueryClient();
  const persistence = persistenceFor(client);
  persistence.activate('alice');
  await persistence.whenReady();
  useEmailStore.getState()._initApi(mockOxy.http);
  client.setQueryData(emailKeys.contacts.list(undefined), page('alice'));
  jest.spyOn(client, 'cancelQueries').mockImplementation(async () => {
    start();
    await gate;
  });
  const view = render(
    <QueryClientProvider client={client}>
      <ScopedContacts />
    </QueryClientProvider>,
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'ui.settings.contacts.delete:alice synthetic' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));
  await started;
  const mutation = client.getMutationCache().getAll().at(-1);
  if (!mutation) throw new Error('Expected mutation');
  act(() => {
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
        <ScopedContacts />
      </QueryClientProvider>,
    );
  });
  await persistence.whenReady();
  client.setQueryData(emailKeys.contacts.list(undefined), page('bob'));
  await act(async () => release());
  await waitFor(() => expect(mutation.state.status).not.toBe('pending'));
  if (sent.length) expect(cacheAtDelete).toEqual(page('bob'));
  expect(sent).toHaveLength(0);
  expect(client.getQueryData(emailKeys.contacts.list(undefined))).toEqual(page('bob'));
  view.unmount();
  persistence.detach();
  client.clear();
});
it.each(['create', 'update'] as const)(
  'rejects a delayed %s preparation after switching accounts',
  async (kind) => {
    let release!: () => void, begin!: () => void;
    const gate = new Promise<void>((r) => {
        release = r;
      }),
      started = new Promise<void>((r) => {
        begin = r;
      });
    const writes: string[] = [];
    globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.method !== 'GET') {
        writes.push(new Headers(init?.headers).get('authorization') ?? '');
        return response({});
      }
      return response(page(mockUser).pages[0]);
    }) as never;
    const client = createInboxQueryClient();
    const persistence = persistenceFor(client);
    persistence.activate('alice');
    await persistence.whenReady();
    useEmailStore.getState()._initApi(mockOxy.http);
    client.setQueryData(emailKeys.contacts.list(undefined), page('alice'));
    jest.spyOn(client, 'cancelQueries').mockImplementation(async () => {
      begin();
      await gate;
    });
    const view = render(
      <QueryClientProvider client={client}>
        <ScopedContacts />
      </QueryClientProvider>,
    );
    if (kind === 'update')
      fireEvent.click(
        screen.getByRole('button', { name: 'ui.settings.contacts.edit:alice synthetic' }),
      );
    fireEvent.change(screen.getByLabelText('ui.settings.contacts.name'), {
      target: { value: 'Synthetic' },
    });
    if (kind === 'create')
      fireEvent.change(screen.getByLabelText('ui.settings.contacts.email'), {
        target: { value: 'synthetic@example.test' },
      });
    fireEvent.click(
      screen.getByRole('button', {
        name:
          kind === 'create'
            ? 'ui.settings.contacts.addContact'
            : 'ui.settings.contacts.saveChanges',
      }),
    );
    await started;
    const mutation = client.getMutationCache().getAll().at(-1);
    if (!mutation) throw new Error('Expected mutation');
    act(() => {
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
          <ScopedContacts />
        </QueryClientProvider>,
      );
    });
    await persistence.whenReady();
    act(() => client.setQueryData(emailKeys.contacts.list(undefined), page('bob')));
    await act(async () => release());
    await waitFor(() => expect(mutation.state.status).not.toBe('pending'));
    expect(writes).toEqual([]);
    expect(client.getQueryData(emailKeys.contacts.list(undefined))).toEqual(page('bob'));
    expect(mockToast.error).not.toHaveBeenCalled();
    view.unmount();
    persistence.detach();
    client.clear();
  },
);
it.each([false, true])(
  'rejects an A confirmation retained until after A to B (returnToA=%s)',
  async (returnToA) => {
    const sent: string[] = [];
    globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.method === 'DELETE')
        sent.push(new Headers(init?.headers).get('authorization') ?? '');
      return response(init?.method === 'GET' ? page(mockUser).pages[0] : {});
    }) as never;
    const client = createInboxQueryClient();
    const persistence = persistenceFor(client);
    persistence.activate('alice');
    await persistence.whenReady();
    useEmailStore.getState()._initApi(mockOxy.http);
    client.setQueryData(emailKeys.contacts.list(undefined), page('alice'));
    const view = render(
      <QueryClientProvider client={client}>
        <ScopedContacts />
      </QueryClientProvider>,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'ui.settings.contacts.delete:alice synthetic' }),
    );
    mockDeferDialogAction = true;
    fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));
    const retained = mockRetainedDialogAction;
    if (!retained) throw new Error('Expected confirmation');
    act(() => {
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
          <ScopedContacts />
        </QueryClientProvider>,
      );
    });
    await persistence.whenReady();
    if (returnToA) {
      act(() => {
        mockUser = 'alice';
        mockOxy.session.setAccessToken(token('alice', 'a-session'));
        mockRuntime.batch(() => {
          mockRuntime.setAccount({ id: 'alice' });
          mockRuntime.setActiveSessionId('a-session');
        });
        useEmailStore.getState().resetAccountScopedState();
        useEmailStore.getState()._initApi(mockOxy.http);
        persistence.activate('alice');
        view.rerender(
          <QueryClientProvider client={client}>
            <ScopedContacts />
          </QueryClientProvider>,
        );
      });
      await persistence.whenReady();
    }
    act(() => retained());
    await waitFor(() =>
      expect(client.getMutationCache().getAll().at(-1)?.state.status).not.toBe('pending'),
    );
    expect(sent).toEqual([]);
    expect(mockToast.error).not.toHaveBeenCalled();
    view.unmount();
    persistence.detach();
    client.clear();
  },
);
it('disables a stale confirmation after the same subject changes session', async () => {
  globalThis.fetch = jest.fn(async () => response({})) as never;
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  client.setQueryData(emailKeys.contacts.list(undefined), page('alice'));
  const view = render(
    <QueryClientProvider client={client}>
      <ScopedContacts />
    </QueryClientProvider>,
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'ui.settings.contacts.delete:alice synthetic' }),
  );
  act(() => {
    mockOxy.session.setAccessToken(token('alice', 'new-session'));
    mockRuntime.setActiveSessionId('new-session');
  });
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: 'common.delete' }) as HTMLButtonElement).disabled,
    ).toBe(true),
  );
  expect(screen.getByText('contacts.toast.selectionExpired')).toBeTruthy();
  expect(globalThis.fetch).not.toHaveBeenCalled();
  view.unmount();
  client.clear();
});
it.each(['create', 'update', 'delete'] as const)(
  'suppresses %s rollback and feedback after account switch',
  async (kind) => {
    let finish!: (value: ReturnType<typeof response>) => void, begin!: () => void;
    const reply = new Promise<ReturnType<typeof response>>((r) => {
        finish = r;
      }),
      started = new Promise<void>((r) => {
        begin = r;
      });
    const sent: string[] = [];
    globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.method !== 'GET') {
        sent.push(new Headers(init?.headers).get('authorization') ?? '');
        begin();
        return reply;
      }
      return response(page(mockUser).pages[0]);
    }) as never;
    const client = createInboxQueryClient();
    const persistence = persistenceFor(client);
    persistence.activate('alice');
    await persistence.whenReady();
    useEmailStore.getState()._initApi(mockOxy.http);
    client.setQueryData(emailKeys.contacts.list(undefined), page('alice'));
    const view = render(
      <QueryClientProvider client={client}>
        <ScopedContacts />
      </QueryClientProvider>,
    );
    if (kind === 'delete') {
      fireEvent.click(
        screen.getByRole('button', { name: 'ui.settings.contacts.delete:alice synthetic' }),
      );
      fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));
    } else {
      if (kind === 'update')
        fireEvent.click(
          screen.getByRole('button', { name: 'ui.settings.contacts.edit:alice synthetic' }),
        );
      fireEvent.change(screen.getByLabelText('ui.settings.contacts.name'), {
        target: { value: 'Synthetic' },
      });
      if (kind === 'create')
        fireEvent.change(screen.getByLabelText('ui.settings.contacts.email'), {
          target: { value: 'synthetic@example.test' },
        });
      fireEvent.click(
        screen.getByRole('button', {
          name:
            kind === 'create'
              ? 'ui.settings.contacts.addContact'
              : 'ui.settings.contacts.saveChanges',
        }),
      );
    }
    await started;
    const mutation = client.getMutationCache().getAll().at(-1);
    if (!mutation) throw new Error('Expected mutation');
    act(() => {
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
          <ScopedContacts />
        </QueryClientProvider>,
      );
    });
    await persistence.whenReady();
    act(() => client.setQueryData(emailKeys.contacts.list(undefined), page('bob')));
    await waitFor(() => expect(screen.getByText('bob synthetic')).toBeTruthy());
    const invalidations = jest.spyOn(client, 'invalidateQueries');
    await act(async () => {
      finish({ ...response({}), ok: false, status: 403, statusText: 'Forbidden' });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() => expect(mutation.state.status).toBe('error'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(client.getQueryData(emailKeys.contacts.list(undefined))).toEqual(page('bob'));
    expect(mockToast.error).not.toHaveBeenCalled();
    expect(mockToast.success).not.toHaveBeenCalled();
    expect(invalidations).not.toHaveBeenCalled();
    expect(sent).toEqual([`Bearer ${token('alice', 'a-session')}`]);
    view.unmount();
    persistence.detach();
    client.clear();
  },
);
it.each(['create', 'update', 'delete'] as const)(
  'keeps same-owner %s optimistic UI and success feedback',
  async (kind) => {
    let finish!: (value: ReturnType<typeof response>) => void, begin!: () => void;
    const reply = new Promise<ReturnType<typeof response>>((r) => {
        finish = r;
      }),
      started = new Promise<void>((r) => {
        begin = r;
      });
    let writes = 0;
    globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.method !== 'GET') {
        writes++;
        begin();
        return reply;
      }
      return response(page('alice').pages[0]);
    }) as never;
    const client = createInboxQueryClient();
    useEmailStore.getState()._initApi(mockOxy.http);
    client.setQueryData(emailKeys.contacts.list(undefined), page('alice'));
    const view = render(
      <QueryClientProvider client={client}>
        <ScopedContacts />
      </QueryClientProvider>,
    );
    if (kind === 'delete') {
      fireEvent.click(
        screen.getByRole('button', { name: 'ui.settings.contacts.delete:alice synthetic' }),
      );
      fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));
    } else {
      if (kind === 'update')
        fireEvent.click(
          screen.getByRole('button', { name: 'ui.settings.contacts.edit:alice synthetic' }),
        );
      fireEvent.change(screen.getByLabelText('ui.settings.contacts.name'), {
        target: { value: 'Synthetic change' },
      });
      if (kind === 'create')
        fireEvent.change(screen.getByLabelText('ui.settings.contacts.email'), {
          target: { value: 'synthetic@example.test' },
        });
      fireEvent.click(
        screen.getByRole('button', {
          name:
            kind === 'create'
              ? 'ui.settings.contacts.addContact'
              : 'ui.settings.contacts.saveChanges',
        }),
      );
    }
    await started;
    const data = client.getQueryData<ReturnType<typeof page>>(emailKeys.contacts.list(undefined));
    if (kind === 'delete') expect(data?.pages[0].data).toHaveLength(0);
    else
      expect(data?.pages[0].data.some((contact) => contact.name === 'Synthetic change')).toBe(true);
    const body =
      kind === 'delete'
        ? {}
        : {
            data: wireContact({
              _id: 'shared-contact',
              id: 'shared-contact',
              userId: 'alice',
              name: 'Synthetic change',
            }),
          };
    await act(async () => {
      finish(response(body));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith(
        `contacts.toast.${kind === 'create' ? 'created' : kind === 'update' ? 'updated' : 'deleted'}`,
      ),
    );
    expect(writes).toBe(1);
    view.unmount();
    client.clear();
  },
);

it.each(['create', 'update'] as const)(
  'keeps the %s form after a same-owner network error',
  async (kind) => {
    globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.method !== 'GET') throw new Error('synthetic offline');
      return response(page('alice').pages[0]);
    }) as never;
    const client = createInboxQueryClient();
    useEmailStore.getState()._initApi(mockOxy.http);
    client.setQueryData(emailKeys.contacts.list(undefined), page('alice'));
    const view = render(
      <QueryClientProvider client={client}>
        <ScopedContacts />
      </QueryClientProvider>,
    );
    if (kind === 'update')
      fireEvent.click(
        screen.getByRole('button', { name: 'ui.settings.contacts.edit:alice synthetic' }),
      );
    fireEvent.change(screen.getByLabelText('ui.settings.contacts.name'), {
      target: { value: 'Draft retained' },
    });
    if (kind === 'create')
      fireEvent.change(screen.getByLabelText('ui.settings.contacts.email'), {
        target: { value: 'synthetic@example.test' },
      });
    fireEvent.click(
      screen.getByRole('button', {
        name:
          kind === 'create'
            ? 'ui.settings.contacts.addContact'
            : 'ui.settings.contacts.saveChanges',
      }),
    );
    await waitFor(() => expect(mockToast.error).toHaveBeenCalled());
    expect((screen.getByLabelText('ui.settings.contacts.name') as HTMLInputElement).value).toBe(
      'Draft retained',
    );
    view.unmount();
    client.clear();
  },
);

it('reports an unavailable current account without clearing the create form', async () => {
  globalThis.fetch = jest.fn() as never;
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <ScopedContacts />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText('ui.settings.contacts.name'), {
    target: { value: 'Draft retained' },
  });
  fireEvent.change(screen.getByLabelText('ui.settings.contacts.email'), {
    target: { value: 'synthetic@example.test' },
  });
  expect(screen.getByText('contacts.form.sessionChanged')).toBeTruthy();
  expect(
    (screen.getByRole('button', { name: 'ui.settings.contacts.addContact' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect((screen.getByLabelText('ui.settings.contacts.name') as HTMLInputElement).value).toBe(
    'Draft retained',
  );
  expect(globalThis.fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'contacts.form.discard' }));
  expect((screen.getByLabelText('ui.settings.contacts.name') as HTMLInputElement).value).toBe('');
  view.unmount();
  client.clear();
});

it.each(['create', 'update'] as const)(
  'blocks a retained %s form after a session change and preserves its text for copying',
  async (kind) => {
    const writes: string[] = [];
    globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.method !== 'GET') writes.push(init?.method ?? '');
      return response(page('alice').pages[0]);
    }) as never;
    const client = createInboxQueryClient();
    useEmailStore.getState()._initApi(mockOxy.http);
    client.setQueryData(emailKeys.contacts.list(undefined), page('alice'));
    const view = render(
      <QueryClientProvider client={client}>
        <ScopedContacts />
      </QueryClientProvider>,
    );
    if (kind === 'update')
      fireEvent.click(
        screen.getByRole('button', { name: 'ui.settings.contacts.edit:alice synthetic' }),
      );
    fireEvent.change(screen.getByLabelText('ui.settings.contacts.name'), {
      target: { value: 'Draft to copy' },
    });
    if (kind === 'create')
      fireEvent.change(screen.getByLabelText('ui.settings.contacts.email'), {
        target: { value: 'draft@example.test' },
      });
    act(() => {
      mockOxy.session.setAccessToken(token('alice', 'new-session'));
      mockRuntime.setActiveSessionId('new-session');
    });
    expect(screen.getByText('contacts.form.sessionChanged')).toBeTruthy();
    const edit = screen.getByRole('button', {
      name: 'ui.settings.contacts.edit:alice synthetic',
    }) as HTMLButtonElement;
    expect(edit.disabled).toBe(true);
    fireEvent.click(edit);
    const save = screen.getByRole('button', {
      name:
        kind === 'create' ? 'ui.settings.contacts.addContact' : 'ui.settings.contacts.saveChanges',
    }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(save);
    expect((screen.getByLabelText('ui.settings.contacts.name') as HTMLInputElement).value).toBe(
      'Draft to copy',
    );
    expect(writes).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'contacts.form.discard' }));
    expect((screen.getByLabelText('ui.settings.contacts.name') as HTMLInputElement).value).toBe('');
    view.unmount();
    client.clear();
  },
);
it('accepts a same-owner request through null-to-id projection recovery', async () => {
  let finish!: (value: ReturnType<typeof response>) => void, begin!: () => void;
  const reply = new Promise<ReturnType<typeof response>>((r) => {
      finish = r;
    }),
    started = new Promise<void>((r) => {
      begin = r;
    });
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method !== 'GET') {
      begin();
      return reply;
    }
    return response(page('alice').pages[0]);
  }) as never;
  mockRuntime.setActiveSessionId(null);
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  client.setQueryData(emailKeys.contacts.list(undefined), page('alice'));
  const view = render(
    <QueryClientProvider client={client}>
      <ScopedContacts />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText('ui.settings.contacts.name'), {
    target: { value: 'Synthetic' },
  });
  fireEvent.change(screen.getByLabelText('ui.settings.contacts.email'), {
    target: { value: 'synthetic@example.test' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'ui.settings.contacts.addContact' }));
  await started;
  act(() => mockRuntime.setActiveSessionId('a-session'));
  await act(async () => {
    finish(
      response({
        data: wireContact({ _id: 'created', id: 'created', userId: 'alice', name: 'Synthetic' }),
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('contacts.toast.created'));
  view.unmount();
  client.clear();
});

it('does not erase edits made while a contact deletion is in flight', async () => {
  let finish!: (value: ReturnType<typeof response>) => void, begin!: () => void;
  const deletion = new Promise<ReturnType<typeof response>>((r) => {
    finish = r;
  });
  const started = new Promise<void>((r) => {
    begin = r;
  });
  globalThis.fetch = jest.fn(async () => {
    begin();
    return deletion;
  }) as never;
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  client.setQueryData(emailKeys.contacts.list(undefined), page('alice'));
  const view = render(
    <QueryClientProvider client={client}>
      <ScopedContacts />
    </QueryClientProvider>,
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'ui.settings.contacts.edit:alice synthetic' }),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'ui.settings.contacts.delete:alice synthetic' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));
  await started;
  fireEvent.change(screen.getByLabelText('ui.settings.contacts.name'), {
    target: { value: 'Unsaved synthetic edit' },
  });
  await act(async () => finish(response({})));
  await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('contacts.toast.deleted'));
  expect((screen.getByLabelText('ui.settings.contacts.name') as HTMLInputElement).value).toBe(
    'Unsaved synthetic edit',
  );
  view.unmount();
  client.clear();
});
it('keeps edits made while a delete confirmation is waiting to close', async () => {
  globalThis.fetch = jest.fn(async () => response({})) as never;
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  client.setQueryData(emailKeys.contacts.list(undefined), page('alice'));
  const view = render(
    <QueryClientProvider client={client}>
      <ScopedContacts />
    </QueryClientProvider>,
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'ui.settings.contacts.edit:alice synthetic' }),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'ui.settings.contacts.delete:alice synthetic' }),
  );
  mockDeferDialogAction = true;
  fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));
  const retained = mockRetainedDialogAction;
  if (!retained) throw new Error('Expected confirmation');
  fireEvent.change(screen.getByLabelText('ui.settings.contacts.name'), {
    target: { value: 'Edit while closing' },
  });
  act(() => retained());
  await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('contacts.toast.deleted'));
  expect((screen.getByLabelText('ui.settings.contacts.name') as HTMLInputElement).value).toBe(
    'Edit while closing',
  );
  view.unmount();
  client.clear();
});

it('preserves newer form edits after the earlier create succeeds', async () => {
  let finish!: (value: ReturnType<typeof response>) => void, begin!: () => void;
  const reply = new Promise<ReturnType<typeof response>>((resolve) => {
    finish = resolve;
  });
  const started = new Promise<void>((resolve) => {
    begin = resolve;
  });
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'POST') {
      begin();
      return reply;
    }
    return response(page('alice').pages[0]);
  }) as never;
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  client.setQueryData(emailKeys.contacts.list(undefined), page('alice'));
  const view = render(
    <QueryClientProvider client={client}>
      <ScopedContacts />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText('ui.settings.contacts.name'), {
    target: { value: 'First draft' },
  });
  fireEvent.change(screen.getByLabelText('ui.settings.contacts.email'), {
    target: { value: 'draft@example.test' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'ui.settings.contacts.addContact' }));
  await started;
  fireEvent.change(screen.getByLabelText('ui.settings.contacts.name'), {
    target: { value: 'Newer draft' },
  });
  await act(async () => {
    finish(
      response({
        data: wireContact({ _id: 'created', id: 'created', userId: 'alice', name: 'First draft' }),
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('contacts.toast.created'));
  expect((screen.getByLabelText('ui.settings.contacts.name') as HTMLInputElement).value).toBe(
    'Newer draft',
  );
  view.unmount();
  client.clear();
});

it('accepts a draft made before null-to-id session projection recovery', async () => {
  const writes: string[] = [];
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'POST') {
      writes.push('POST');
      return response({
        data: wireContact({ _id: 'created', id: 'created', userId: 'alice', name: 'Draft' }),
      });
    }
    return response(page('alice').pages[0]);
  }) as never;
  mockRuntime.setActiveSessionId(null);
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  client.setQueryData(emailKeys.contacts.list(undefined), page('alice'));
  const view = render(
    <QueryClientProvider client={client}>
      <ScopedContacts />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText('ui.settings.contacts.name'), {
    target: { value: 'Draft' },
  });
  fireEvent.change(screen.getByLabelText('ui.settings.contacts.email'), {
    target: { value: 'draft@example.test' },
  });
  act(() => mockRuntime.setActiveSessionId('a-session'));
  expect(screen.queryByText('contacts.form.sessionChanged')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'ui.settings.contacts.addContact' }));
  await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('contacts.toast.created'));
  expect(writes).toEqual(['POST']);
  view.unmount();
  client.clear();
});

it('does not clear an earlier-session draft after a current-session deletion', async () => {
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) =>
    init?.method === 'DELETE' ? response({}) : response(page('alice').pages[0]),
  ) as never;
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  client.setQueryData(emailKeys.contacts.list(undefined), page('alice'));
  const view = render(
    <QueryClientProvider client={client}>
      <ScopedContacts />
    </QueryClientProvider>,
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'ui.settings.contacts.edit:alice synthetic' }),
  );
  fireEvent.change(screen.getByLabelText('ui.settings.contacts.name'), {
    target: { value: 'Draft to copy' },
  });
  act(() => {
    mockOxy.session.setAccessToken(token('alice', 'new-session'));
    mockRuntime.setActiveSessionId('new-session');
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'ui.settings.contacts.delete:alice synthetic' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));
  await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('contacts.toast.deleted'));
  expect((screen.getByLabelText('ui.settings.contacts.name') as HTMLInputElement).value).toBe(
    'Draft to copy',
  );
  expect(screen.getByText('contacts.form.sessionChanged')).toBeTruthy();
  view.unmount();
  client.clear();
});
