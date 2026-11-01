import type { ReactNode } from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { OxyServices } from '@oxy.so/core';
import { createInboxQueryClient, INBOX_ACCOUNT_QUERIES } from '@/hooks/queries/queryClient';
import { emailKeys } from '@/hooks/queries/queryKeys';
import { useEmailStore } from '@/hooks/useEmail';
import { MessageSchema } from '@/schemas/emailSchemas';
import { wireDelivery, wireMessage } from '../fixtures/wire';

let mockOxy: OxyServices;
let mockUser: string | null;
let mockRuntime: ReturnType<typeof import('@oxy.so/services/runtime').useOxyRuntime>;
const mockToast = { error: jest.fn(), success: jest.fn() };
jest.mock('@oxy.so/services/runtime', () => ({ useOxyRuntime: () => mockRuntime }));
jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({ oxyServices: mockOxy, user: mockUser === null ? null : { id: mockUser } }),
}));
jest.mock('@oxy.so/bloom/toast', () => ({ toast: mockToast }));
jest.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'en' }),
}));
jest.mock('@/hooks/mutations/useEditAsNew', () => ({
  useEditAsNew: () => ({ editAsNew: jest.fn(), isPending: false }),
}));
jest.mock('@/constants/theme', () => ({
  useColors: () => ({ error: 'red', warning: 'orange', secondaryText: 'grey' }),
}));
jest.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  View: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('@oxy.so/bloom/typography', () => ({
  Text: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('@oxy.so/bloom/admonition', () => {
  const pass = ({ children }: { children: ReactNode }) => children;
  return {
    AdmonitionRoot: pass,
    AdmonitionRow: pass,
    AdmonitionIcon: () => null,
    AdmonitionContent: pass,
    AdmonitionText: pass,
    AdmonitionButton: ({
      children,
      onPress,
      disabled,
    }: {
      children: ReactNode;
      onPress: () => void;
      disabled?: boolean;
    }) => (
      <button type="button" onClick={onPress} disabled={disabled}>
        {children}
      </button>
    ),
  };
});
import { DeliveryNotice } from '@/components/DeliveryStatus';
import { useRetryDelivery } from '@/hooks/mutations/useRetryDelivery';

function token(subject: string, session: string) {
  return `e30.${Buffer.from(JSON.stringify({ userId: subject, sessionId: session, exp: 2000000000 })).toString('base64url')}.fixture`;
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
const input = () =>
  MessageSchema.parse(
    wireMessage({ _id: 'synthetic-message', userId: 'alice', delivery: wireDelivery() }),
  );
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
function changeToBob() {
  mockUser = 'bob';
  mockOxy.session.setAccessToken(token('bob', 'b-session'));
  mockRuntime.batch(() => {
    mockRuntime.setAccount({ id: 'bob' });
    mockRuntime.setActiveSessionId('b-session');
  });
}
function setupPersistence(client: ReturnType<typeof createInboxQueryClient>) {
  const { dirname, join } = require('node:path');
  const dir = dirname(require.resolve('@oxy.so/services/package.json'));
  const { createAccountQueryPersistence } = require(
    join(dir, 'lib/commonjs/ui/hooks/accountQueryPersistence.js'),
  );
  const values = new Map<string, string>();
  const storage = {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: async (key: string) => {
      values.delete(key);
    },
  };
  const persistence = createAccountQueryPersistence(client, INBOX_ACCOUNT_QUERIES);
  persistence.setStorage(storage);
  persistence.attach();
  return persistence;
}

it.each([false, true])(
  'does not publish an A response after A to B (returnToA=%s)',
  async (returnToA) => {
    let finish!: (value: ReturnType<typeof response>) => void, begin!: () => void;
    const pending = new Promise<ReturnType<typeof response>>((resolve) => {
      finish = resolve;
    });
    const started = new Promise<void>((resolve) => {
      begin = resolve;
    });
    const headers: string[] = [];
    globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      headers.push(new Headers(init?.headers).get('authorization') ?? '');
      begin();
      return pending;
    }) as never;
    const client = createInboxQueryClient();
    const persistence = setupPersistence(client);
    persistence.activate('alice');
    await persistence.whenReady();
    useEmailStore.getState()._initApi(mockOxy.http);
    const view = render(
      <QueryClientProvider client={client}>
        <DeliveryNotice message={input()} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByText('delivery.retry'));
    await started;
    const mutation = client.getMutationCache().getAll().at(-1);
    if (!mutation) throw new Error('Expected in-flight mutation');
    act(() => {
      changeToBob();
      useEmailStore.getState().resetAccountScopedState();
      useEmailStore.getState()._initApi(mockOxy.http);
      persistence.activate('bob');
      view.rerender(
        <QueryClientProvider client={client}>
          <DeliveryNotice message={input()} />
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
            <DeliveryNotice message={input()} />
          </QueryClientProvider>,
        );
      });
      await persistence.whenReady();
    }
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    await act(async () => {
      finish(
        response({
          data: wireMessage({
            _id: 'synthetic-message',
            userId: 'alice',
            delivery: wireDelivery({ state: 'sending' }),
          }),
        }),
      );
    });
    await waitFor(() => expect(mutation.state.status).not.toBe('pending'));
    expect(
      client.getQueryData(emailKeys.message.detail('synthetic-message', 'alice')),
    ).toBeUndefined();
    expect(invalidate).not.toHaveBeenCalled();
    expect(mockToast.error).not.toHaveBeenCalled();
    expect(mockToast.success).not.toHaveBeenCalled();
    expect(headers).toEqual([`Bearer ${token('alice', 'a-session')}`]);
    view.unmount();
    persistence.detach();
    client.clear();
  },
);

it('shows confirmation and updates the original message when the owner stays current', async () => {
  let release!: (value: ReturnType<typeof response>) => void, begin!: () => void;
  const pending = new Promise<ReturnType<typeof response>>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    begin = resolve;
  });
  globalThis.fetch = jest.fn(async () => {
    begin();
    return pending;
  }) as never;
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  const view = render(
    <QueryClientProvider client={client}>
      <DeliveryNotice message={input()} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByText('delivery.retry'));
  await started;
  await waitFor(() =>
    expect((screen.getByText('delivery.retry') as HTMLButtonElement).disabled).toBe(true),
  );
  await act(async () => {
    release(
      response({
        data: wireMessage({
          _id: 'synthetic-message',
          userId: 'alice',
          delivery: wireDelivery({ state: 'sending' }),
        }),
      }),
    );
  });
  await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('delivery.retryStarted'));
  expect(
    client.getQueryData(emailKeys.message.detail('synthetic-message', 'alice')),
  ).toHaveProperty('delivery.state', 'sending');
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  view.unmount();
  client.clear();
});

it('reports a network failure to the current owner without automatically retrying on reconnect', async () => {
  onlineManager.setOnline(false);
  globalThis.fetch = jest.fn(async () => {
    throw new Error('synthetic offline');
  }) as never;
  const client = createInboxQueryClient();
  client.mount();
  useEmailStore.getState()._initApi(mockOxy.http);
  const view = render(
    <QueryClientProvider client={client}>
      <DeliveryNotice message={input()} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByText('delivery.retry'));
  await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('delivery.retryError'));
  await act(async () => {
    onlineManager.setOnline(true);
    await client.getMutationCache().resumePausedMutations();
  });
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  expect((screen.getByText('delivery.retry') as HTMLButtonElement).disabled).toBe(false);
  view.unmount();
  client.unmount();
  client.clear();
});

it('reports an unavailable current session without issuing a request', async () => {
  globalThis.fetch = jest.fn() as never;
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <DeliveryNotice message={input()} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByText('delivery.retry'));
  await waitFor(() =>
    expect(mockToast.error).toHaveBeenCalledWith('ui.mutations.messageSessionUnavailable'),
  );
  expect(globalThis.fetch).not.toHaveBeenCalled();
  view.unmount();
  client.clear();
});

it('rejects a retained action after A to B to A even if the old screen is mounted', async () => {
  globalThis.fetch = jest.fn() as never;
  const client = createInboxQueryClient();
  useEmailStore.getState()._initApi(mockOxy.http);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(() => useRetryDelivery(), { wrapper });
  const retained = result.current.mutate;
  act(() => {
    changeToBob();
    mockUser = 'alice';
    mockOxy.session.setAccessToken(token('alice', 'a-session'));
    mockRuntime.batch(() => {
      mockRuntime.setAccount({ id: 'alice' });
      mockRuntime.setActiveSessionId('a-session');
    });
  });
  act(() => retained({ messageId: 'synthetic-message' }));
  await waitFor(() =>
    expect(client.getMutationCache().getAll().at(-1)?.state.status).toBe('error'),
  );
  expect(globalThis.fetch).not.toHaveBeenCalled();
  expect(mockToast.error).not.toHaveBeenCalled();
  unmount();
  client.clear();
});
