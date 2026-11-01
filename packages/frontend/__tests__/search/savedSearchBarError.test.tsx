import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { createEmailApi } from '@/services/emailApi';
import { emailKeys } from '@/hooks/queries/queryKeys';
import { INBOX_DICTS } from '@/lib/i18n/translate';
import { SUPPORTED_LOCALES } from '@/lib/i18n/types';

const mockHttp = { get: jest.fn() };
let mockApi: ReturnType<typeof createEmailApi>;
const mockSession = { userId: 'alice' };
const mockAuth = {
  getSessionEpoch: () => 0,
  getAccessToken: () => 'token',
  addTokenChangeListener: () => () => {},
};
jest.mock('@/hooks/useEmail', () => ({
  useEmailStore: Object.assign(
    (select: (state: { _api: typeof mockApi }) => unknown) => select({ _api: mockApi }),
    { getState: () => ({ _api: mockApi }) },
  ),
}));
jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({ user: { id: 'alice' }, oxyServices: { http: mockAuth, session: mockSession } }),
}));
jest.mock('@oxy.so/bloom/toast', () => ({ toast: { error: jest.fn() } }));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native', () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock('@oxy.so/bloom/button', () => ({
  Button: ({
    children,
    onPress,
    accessibilityLabel,
  }: {
    children: ReactNode;
    onPress: () => void;
    accessibilityLabel?: string;
  }) => (
    <button type="button" onClick={onPress} aria-label={accessibilityLabel}>
      {children}
    </button>
  ),
}));
jest.mock('@oxy.so/bloom/chip', () => ({
  Chip: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock('@oxy.so/bloom/dialog', () => ({ Dialog: () => null }));
jest.mock('@oxy.so/bloom/text-field', () => ({ TextFieldInput: () => null }));
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

it('shows an error and can retry when saved searches fail to load with no active search', async () => {
  mockHttp.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([
    {
      id: 'a',
      name: 'Recovered search',
      query: 'hello',
      filters: {},
      order: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ]);
  mockApi = createEmailApi(mockHttp as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SavedSearchBar query="" filters={{}} enabled={false} onApply={() => {}} />
    </QueryClientProvider>,
  );
  expect(await screen.findByText('search.saved.loadFailed')).toBeTruthy();
  expect(screen.getByText('search.ui.savedSearches')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'common.retry: search.ui.savedSearches' }));
  await waitFor(() => expect(screen.getByText('Recovered search')).toBeTruthy());
  expect(screen.queryByText('search.saved.loadFailed')).toBeNull();
  client.clear();
});

it('provides every saved-search status message in each supported locale', () => {
  for (const locale of SUPPORTED_LOCALES) {
    const dict = INBOX_DICTS[locale]?.search as Record<string, Record<string, unknown>>;
    for (const name of [
      'loadFailed',
      'refreshFailed',
      'offlineEmpty',
      'offlineCached',
      'retryPaused',
    ]) {
      expect(typeof dict.saved[name]).toBe('string');
      expect(dict.saved[name]).not.toBe('');
    }
  }
});

it('keeps a cached list visible and distinguishes a failed refresh', async () => {
  const row = {
    id: 'a',
    name: 'Cached search',
    query: 'hello',
    filters: {},
    order: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  mockHttp.get.mockReset().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
  mockApi = createEmailApi(mockHttp as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(emailKeys.savedSearches, [row]);
  render(
    <QueryClientProvider client={client}>
      <SavedSearchBar query="" filters={{}} enabled={false} onApply={() => {}} />
    </QueryClientProvider>,
  );
  expect(await screen.findByText('search.saved.refreshFailed')).toBeTruthy();
  expect(screen.getByText('Cached search')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'common.retry: search.ui.savedSearches' }));
  await waitFor(() => expect(screen.queryByText('Cached search')).toBeNull());
  expect(screen.queryByText('search.saved.refreshFailed')).toBeNull();
  client.clear();
});

it.each([false, true])('announces a paused offline query with cached data=%s', async (cached) => {
  const row = {
    id: 'a',
    name: 'Cached search',
    query: 'hello',
    filters: {},
    order: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  mockHttp.get.mockReset().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
  mockApi = createEmailApi(mockHttp as never);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: 1, retryDelay: 0, networkMode: 'offlineFirst' } },
  });
  if (cached) client.setQueryData(emailKeys.savedSearches, [row]);
  try {
    onlineManager.setOnline(false);
    render(
      <QueryClientProvider client={client}>
        <SavedSearchBar query="" filters={{}} enabled={false} onApply={() => {}} />
      </QueryClientProvider>,
    );
    const status = await screen.findByText(
      cached ? 'search.saved.offlineCached' : 'search.saved.offlineEmpty',
    );
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(
      screen.queryByRole('button', { name: 'common.retry: search.ui.savedSearches' }),
    ).toBeNull();
    if (cached) expect(screen.getByText('Cached search')).toBeTruthy();
    onlineManager.setOnline(true);
    await waitFor(() =>
      expect(
        screen.queryByText(cached ? 'search.saved.offlineCached' : 'search.saved.offlineEmpty'),
      ).toBeNull(),
    );
  } finally {
    onlineManager.setOnline(true);
    client.clear();
  }
});

it('does not describe a focus-paused retry as offline', async () => {
  mockHttp.get.mockReset().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce([]);
  mockApi = createEmailApi(mockHttp as never);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: 1, retryDelay: 0, networkMode: 'offlineFirst' } },
  });
  try {
    onlineManager.setOnline(true);
    focusManager.setFocused(false);
    render(
      <QueryClientProvider client={client}>
        <SavedSearchBar query="" filters={{}} enabled={false} onApply={() => {}} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('search.saved.retryPaused')).toBeTruthy();
    expect(screen.queryByText('search.saved.offlineEmpty')).toBeNull();
    focusManager.setFocused(true);
    await waitFor(() => expect(screen.queryByText('search.saved.retryPaused')).toBeNull());
  } finally {
    focusManager.setFocused(true);
    client.clear();
  }
});
