import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createEmailApi } from '@/services/emailApi';
import { emailKeys } from '@/hooks/queries/queryKeys';

const mockTransportA = { get: jest.fn(), post: jest.fn(), delete: jest.fn() };
const mockTransportB = { get: jest.fn(), post: jest.fn(), delete: jest.fn() };
let mockApi: ReturnType<typeof createEmailApi>;
let mockUser = 'alice';
let mockEpoch = 0;
const mockListeners = new Set<() => void>();
const mockHttp = {
  getSessionEpoch: () => mockEpoch,
  getAccessToken: () => 'synthetic',
  addTokenChangeListener: (listener: () => void) => {
    mockListeners.add(listener);
    return () => mockListeners.delete(listener);
  },
};
const mockSession = {
  get userId() {
    return mockUser;
  },
};
jest.mock('@/hooks/useEmail', () => ({
  useEmailStore: Object.assign(
    (select: (s: { _api: typeof mockApi }) => unknown) => select({ _api: mockApi }),
    { getState: () => ({ _api: mockApi }) },
  ),
}));
jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({ user: { id: mockUser }, oxyServices: { http: mockHttp, session: mockSession } }),
}));
jest.mock('@oxy.so/bloom/toast', () => ({ toast: { error: jest.fn() } }));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native', () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock('@oxy.so/bloom/button', () => ({
  Button: ({ children, onPress }: { children: ReactNode; onPress: () => void }) => (
    <button type="button" onClick={onPress}>
      {children}
    </button>
  ),
}));
jest.mock('@oxy.so/bloom/chip', () => ({
  Chip: ({
    children,
    onPress,
    onClose,
    accessibilityLabel,
    closeLabel,
  }: {
    children: ReactNode;
    onPress: () => void;
    onClose?: () => void;
    accessibilityLabel: string;
    closeLabel: string;
  }) => (
    <div>
      <button type="button" onClick={onPress} aria-label={accessibilityLabel}>
        {children}
      </button>
      {onClose && (
        <button type="button" onClick={onClose} aria-label={closeLabel}>
          x
        </button>
      )}
    </div>
  ),
}));
jest.mock('@oxy.so/bloom/dialog', () => ({
  Dialog: ({
    open,
    actions,
    children,
  }: {
    open: boolean;
    actions: { label: string; onPress?: () => void; disabled?: boolean }[];
    children: ReactNode;
  }) =>
    open ? (
      <div>
        {children}
        {actions.map((action) => (
          <button
            type="button"
            key={action.label}
            onClick={action.onPress}
            disabled={action.disabled}
          >
            {action.label}
          </button>
        ))}
      </div>
    ) : null,
}));
jest.mock('@oxy.so/bloom/text-field', () => ({
  TextFieldInput: ({
    value,
    onChangeText,
    label,
  }: {
    value: string;
    onChangeText: (value: string) => void;
    label: string;
  }) => (
    <input
      aria-label={label}
      value={value}
      onChange={(event) => onChangeText(event.target.value)}
    />
  ),
}));
jest.mock('@oxy.so/bloom/typography', () => ({
  Text: ({
    children,
    accessibilityLiveRegion,
  }: {
    children: ReactNode;
    accessibilityLiveRegion?: string;
  }) => <span aria-live={accessibilityLiveRegion}>{children}</span>,
}));

import { SavedSearchBar } from '@/components/SavedSearchBar';
const row = (id: string) => ({
  id,
  name: `name-${id}`,
  query: id,
  filters: {},
  order: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});
let client: QueryClient;
const wrap = () => (
  <QueryClientProvider client={client}>
    <SavedSearchBar query="query" filters={{}} enabled onApply={() => {}} />
  </QueryClientProvider>
);
beforeEach(() => {
  jest.resetAllMocks();
  mockUser = 'alice';
  mockEpoch = 0;
  mockApi = createEmailApi(mockTransportA as never);
  mockTransportA.get.mockResolvedValue([row('a'), row('b')]);
  mockTransportB.get.mockResolvedValue([row('b')]);
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { networkMode: 'offlineFirst', retry: false, gcTime: Infinity },
    },
  });
});
afterEach(() => {
  onlineManager.setOnline(true);
  client.clear();
});

it('keeps confirmed offline data while deletion is pending and suppresses duplicate taps', async () => {
  let finish!: () => void;
  mockTransportA.delete.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  render(wrap());
  const remove = await screen.findAllByRole('button', { name: 'search.ui.deleteSaved' });
  act(() => {
    fireEvent.click(remove[0]);
    fireEvent.click(remove[0]);
  });
  await waitFor(() => expect(mockTransportA.delete).toHaveBeenCalledTimes(1));
  expect(client.getQueryData(emailKeys.savedSearches)).toEqual([row('a'), row('b')]);
  expect(screen.getByText('common.loading').getAttribute('aria-live')).toBe('polite');
  expect(screen.queryByRole('button', { name: 'search.ui.deleteSaved' })).toBeNull();
  expect(screen.getAllByRole('button', { name: 'search.ui.runSaved' })).toHaveLength(2);
  mockTransportA.get.mockResolvedValue([row('b')]);
  await act(async () => {
    finish();
  });
  await waitFor(() => expect(client.getQueryData(emailKeys.savedSearches)).toEqual([row('b')]));
});

it('does not submit the same save twice before the pending state renders', async () => {
  let finish!: (value: unknown) => void;
  mockTransportA.post.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  render(wrap());
  fireEvent.click(screen.getByRole('button', { name: 'search.ui.saveSearch' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'search.ui.searchName' }), {
    target: { value: 'Synthetic' },
  });
  const save = screen.getByRole('button', { name: 'common.save' });
  act(() => {
    fireEvent.click(save);
    fireEvent.click(save);
  });
  await waitFor(() => expect(mockTransportA.post).toHaveBeenCalledTimes(1));
  mockTransportA.get.mockResolvedValue([row('a'), row('b'), row('created')]);
  await act(async () => {
    finish(row('created'));
  });
  await waitFor(() =>
    expect(screen.queryByRole('textbox', { name: 'search.ui.searchName' })).toBeNull(),
  );
});

it('allows B to start a deletion without an old A completion clearing its pending indicator', async () => {
  let finishA!: () => void;
  let finishB!: () => void;
  mockTransportA.delete.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finishA = resolve;
    }),
  );
  mockTransportB.delete.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finishB = resolve;
    }),
  );
  const view = render(wrap());
  fireEvent.click((await screen.findAllByRole('button', { name: 'search.ui.deleteSaved' }))[0]);
  await waitFor(() => expect(mockTransportA.delete).toHaveBeenCalledTimes(1));
  act(() => {
    mockUser = 'bob';
    mockEpoch++;
    mockApi = createEmailApi(mockTransportB as never);
    for (const listener of mockListeners) listener();
    client.removeQueries({ queryKey: emailKeys.savedSearches });
    client.setQueryData(emailKeys.savedSearches, [row('b')]);
    view.rerender(wrap());
  });
  fireEvent.click(await screen.findByRole('button', { name: 'search.ui.deleteSaved' }));
  await waitFor(() => expect(mockTransportB.delete).toHaveBeenCalledTimes(1));
  await act(async () => {
    finishA();
  });
  expect(screen.getByText('common.loading')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'search.ui.deleteSaved' })).toBeNull();
  mockTransportB.get.mockResolvedValue([]);
  await act(async () => {
    finishB();
  });
  await waitFor(() => expect(screen.queryByText('common.loading')).toBeNull());
});

it('retains B pending and allows cached searches while reconciliation pauses offline', async () => {
  client.setDefaultOptions({
    queries: { networkMode: 'offlineFirst', retry: 2, retryDelay: 0, gcTime: Infinity },
    mutations: { networkMode: 'offlineFirst', retry: false, gcTime: Infinity },
  });
  mockTransportA.delete.mockResolvedValue(undefined);
  render(wrap());
  const remove = (await screen.findAllByRole('button', { name: 'search.ui.deleteSaved' }))[0];
  act(() => onlineManager.setOnline(false));
  mockTransportA.get.mockRejectedValue(new Error('network'));
  fireEvent.click(remove);
  await waitFor(() =>
    expect(client.getQueryState(emailKeys.savedSearches)?.fetchStatus).toBe('paused'),
  );
  expect(screen.getByText('search.saved.offlineCached')).toBeTruthy();
  expect(screen.getByText('common.loading')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'search.ui.deleteSaved' })).toBeNull();
  expect(screen.getAllByRole('button', { name: 'search.ui.runSaved' })).toHaveLength(2);
  expect(client.getQueryData(emailKeys.savedSearches)).toEqual([row('a'), row('b')]);
  mockTransportA.get.mockResolvedValue([row('b')]);
  await act(async () => {
    onlineManager.setOnline(true);
  });
  await waitFor(() => expect(client.getQueryData(emailKeys.savedSearches)).toEqual([row('b')]));
  await waitFor(() => expect(screen.queryByText('common.loading')).toBeNull());
});

it('keeps the newest A pending across an observed A to B to A transition', async () => {
  let finishOldA!: () => void;
  let finishB!: () => void;
  let finishNewA!: () => void;
  mockTransportA.delete
    .mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishOldA = resolve;
      }),
    )
    .mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishNewA = resolve;
      }),
    );
  mockTransportB.delete.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finishB = resolve;
    }),
  );
  const view = render(wrap());
  fireEvent.click((await screen.findAllByRole('button', { name: 'search.ui.deleteSaved' }))[0]);
  await waitFor(() => expect(mockTransportA.delete).toHaveBeenCalledTimes(1));
  act(() => {
    mockUser = 'bob';
    mockEpoch++;
    mockApi = createEmailApi(mockTransportB as never);
    for (const listener of mockListeners) listener();
    client.removeQueries({ queryKey: emailKeys.savedSearches });
    client.setQueryData(emailKeys.savedSearches, [row('b')]);
    view.rerender(wrap());
  });
  fireEvent.click(await screen.findByRole('button', { name: 'search.ui.deleteSaved' }));
  await waitFor(() => expect(mockTransportB.delete).toHaveBeenCalledTimes(1));
  act(() => {
    mockUser = 'alice';
    mockEpoch++;
    mockApi = createEmailApi(mockTransportA as never);
    for (const listener of mockListeners) listener();
    client.removeQueries({ queryKey: emailKeys.savedSearches });
    client.setQueryData(emailKeys.savedSearches, [row('a'), row('b')]);
    view.rerender(wrap());
  });
  fireEvent.click((await screen.findAllByRole('button', { name: 'search.ui.deleteSaved' }))[0]);
  await waitFor(() => expect(mockTransportA.delete).toHaveBeenCalledTimes(2));
  await act(async () => {
    finishOldA();
    finishB();
  });
  expect(screen.getByText('common.loading')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'search.ui.deleteSaved' })).toBeNull();
  mockTransportA.get.mockResolvedValue([row('b')]);
  await act(async () => {
    finishNewA();
  });
  await waitFor(() => expect(screen.queryByText('common.loading')).toBeNull());
});

it('keeps deletion pending after navigation remount and prevents a second request', async () => {
  let finish!: () => void;
  mockTransportA.delete.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  const first = render(wrap());
  fireEvent.click((await screen.findAllByRole('button', { name: 'search.ui.deleteSaved' }))[0]);
  await waitFor(() => expect(mockTransportA.delete).toHaveBeenCalledTimes(1));
  first.unmount();
  render(wrap());
  await waitFor(() => expect(screen.getByText('common.loading')).toBeTruthy());
  expect(screen.queryByRole('button', { name: 'search.ui.deleteSaved' })).toBeNull();
  expect(screen.getAllByRole('button', { name: 'search.ui.runSaved' })).toHaveLength(2);
  mockTransportA.get.mockResolvedValue([row('b')]);
  await act(async () => {
    finish();
  });
  await waitFor(() => expect(screen.queryByText('common.loading')).toBeNull());
  expect(mockTransportA.delete).toHaveBeenCalledTimes(1);
});

it('keeps save disabled after navigation remount while the old save is pending', async () => {
  let finish!: (value: unknown) => void;
  mockTransportA.post.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const first = render(wrap());
  fireEvent.click(screen.getByRole('button', { name: 'search.ui.saveSearch' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'search.ui.searchName' }), {
    target: { value: 'Synthetic' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'common.save' }));
  await waitFor(() => expect(mockTransportA.post).toHaveBeenCalledTimes(1));
  first.unmount();
  render(wrap());
  fireEvent.click(screen.getByRole('button', { name: 'search.ui.saveSearch' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'search.ui.searchName' }), {
    target: { value: 'Synthetic' },
  });
  expect((screen.getByRole('button', { name: 'common.save' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  expect(mockTransportA.post).toHaveBeenCalledTimes(1);
  mockTransportA.get.mockResolvedValue([row('a'), row('b'), row('created')]);
  await act(async () => {
    finish(row('created'));
  });
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: 'common.save' }) as HTMLButtonElement).disabled,
    ).toBe(false),
  );
});
