import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { OxyServices } from '@oxy.so/core';
import { createContext, type ReactNode, startTransition, StrictMode, Suspense } from 'react';
import { createInboxQueryClient } from '@/hooks/queries/queryClient';

let mockOxy: OxyServices;
let mockRuntime: ReturnType<typeof import('@oxy.so/services/runtime').useOxyRuntime>;
const mockRuntimeContext = createContext<typeof mockRuntime | null>(null);
let mockOptions: Record<string, unknown>;
let mockSearchEnabled = false;
let mockUseRealSearch = false;
let mockSearchData: unknown;
let mockRenderedItems: unknown[] = [];
let mockApply: (() => void) | undefined;
let mockClose: (() => void) | undefined;
let mockFromChange: ((value: string) => void) | undefined;
let mockQuick: ((checked: boolean) => void) | undefined;
let mockClear: (() => void) | undefined;
let mockApplySaved:
  | ((value: { query: string; filters: { dateAfter?: string } }) => void)
  | undefined;
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
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    FlatList: ({
      ListHeaderComponent,
      data,
    }: {
      ListHeaderComponent: ReactNode;
      data: unknown[];
    }) => {
      mockRenderedItems = data;
      return <div>{ListHeaderComponent}</div>;
    },
  },
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
  Button: ({ children, onPress }: { children: ReactNode; onPress?: () => void }) => {
    if (children === 'search.ui.clearFilters') mockClear = onPress;
    return (
      <button type="button" onClick={onPress}>
        {children}
      </button>
    );
  },
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
jest.mock('@oxy.so/bloom/field', () => ({
  Field: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock('@oxy.so/bloom/chip', () => ({
  Chip: ({
    children,
    onCheckedChange,
    onClose,
  }: {
    children: ReactNode;
    onCheckedChange?: (checked: boolean) => void;
    onClose?: () => void;
  }) => {
    if (children === 'search.filters.hasAttachment') mockQuick = onCheckedChange;
    return (
      <span>
        {children}
        {onClose && <button type="button" aria-label="remove-chip" onClick={onClose} />}
      </span>
    );
  },
}));
jest.mock('@oxy.so/bloom/date-picker', () => ({ DateRangePicker: () => null }));
jest.mock('@oxy.so/bloom/dialog', () => ({
  Dialog: ({
    open,
    onClose,
    header,
    children,
  }: {
    open: boolean;
    onClose: () => void;
    header: { primaryAction: { onPress: () => void; disabled?: boolean } };
    children: ReactNode;
  }) => {
    if (!open) return null;
    mockApply = header.primaryAction.onPress;
    mockClose = onClose;
    return (
      <div>
        <button
          type="button"
          aria-label="apply-filter"
          onClick={header.primaryAction.onPress}
          disabled={header.primaryAction.disabled}
        >
          apply
        </button>
        <button type="button" aria-label="close-filter" onClick={onClose}>
          close
        </button>
        {children}
      </div>
    );
  },
}));
jest.mock('@oxy.so/bloom/select', () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: () => null,
  SelectIcon: () => null,
  SelectItem: () => null,
  SelectItemIndicator: () => null,
  SelectItemText: () => null,
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
}));
jest.mock('@oxy.so/bloom/text-field', () => ({
  TextFieldInput: ({
    label,
    value,
    onChangeText,
  }: {
    label: string;
    value: string;
    onChangeText: (v: string) => void;
  }) => {
    if (label === 'search.filters.from') mockFromChange = onChangeText;
    return (
      <input aria-label={label} value={value} onChange={(e) => onChangeText(e.target.value)} />
    );
  },
}));
jest.mock('@oxy.so/bloom/icons/RiAttachmentLine', () => ({ RiAttachmentLine: () => null }));
jest.mock('@oxy.so/bloom/icons/RiFilterLine', () => ({ RiFilterLine: () => null }));
jest.mock('@oxy.so/bloom/icons/RiMailLine', () => ({ RiMailLine: () => null }));
jest.mock('@oxy.so/bloom/icons/RiStarLine', () => ({ RiStarLine: () => null }));
jest.mock('@/components/SavedSearchBar', () => ({
  SavedSearchBar: ({ onApply }: { onApply: typeof mockApplySaved }) => {
    mockApplySaved = onApply;
    return null;
  },
}));
jest.mock('@/components/EmptyStateSticker', () => ({ EmptyStateSticker: () => null }));
jest.mock('@/components/MessageRow', () => ({ MessageRow: () => null }));
jest.mock('@/components/UnreadableMessageRow', () => ({ UnreadableMessageRow: () => null }));
jest.mock('@/contexts/search-focus-context', () => ({
  useSearchFocus: () => ({ registerInput: () => {} }),
}));
jest.mock('@/hooks/useGoBack', () => ({ useGoBack: () => () => {} }));
jest.mock('@/hooks/useMailboxScrollRestoration', () => ({
  useMailboxScrollRestoration: () => () => {},
}));
jest.mock('@/hooks/queries/useLabels', () => ({ useLabels: () => ({ data: [] }) }));
jest.mock('@/hooks/queries/useMailboxes', () => ({ useMailboxes: () => ({ data: [] }) }));
jest.mock('@/hooks/queries/useSearchMessages', () => ({
  useSearchMessages: (options: Record<string, unknown>, { enabled }: { enabled: boolean }) => {
    mockOptions = options;
    mockSearchEnabled = enabled;
    if (mockUseRealSearch) {
      return jest.requireActual('@/hooks/queries/useSearchMessages').useSearchMessages(options, {
        enabled,
      });
    }
    return {
      data: mockSearchData,
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
import { useEmailStore } from '@/hooks/useEmail';

function token(session: string) {
  return `e30.${Buffer.from(JSON.stringify({ userId: 'alice', sessionId: session, exp: 2000000000 })).toString('base64url')}.fixture`;
}
async function setup(strict = false) {
  mockSearchData = undefined;
  mockRenderedItems = [];
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
    useEmailStore.setState({ _api: null });
    mockUseRealSearch = false;
    jest.restoreAllMocks();
  };
  return { view, input, client, post, pending, tree, submit, change, cleanup };
}

it('does not expose or apply an open A filter draft after switching to B', async () => {
  const { view, change, cleanup } = await setup();
  fireEvent.click(view.getByText('search.ui.filtersTitle'));
  fireEvent.change(view.getByLabelText('search.filters.from'), {
    target: { value: 'private@example.test' },
  });
  expect((view.getByLabelText('search.filters.from') as HTMLInputElement).value).toBe(
    'private@example.test',
  );
  change('session-b');
  expect(view.queryByDisplayValue('private@example.test')).toBeNull();
  fireEvent.click(view.getByLabelText('apply-filter'));
  expect(mockOptions.from).toBeUndefined();
  cleanup();
});

it('does not apply an A filter draft to B', async () => {
  const { view, change, cleanup } = await setup();
  fireEvent.click(view.getByText('search.ui.filtersTitle'));
  fireEvent.change(view.getByLabelText('search.filters.from'), {
    target: { value: 'private@example.test' },
  });
  change('session-b');
  fireEvent.click(view.getByLabelText('apply-filter'));
  expect(mockOptions.from).toBeUndefined();
  cleanup();
});

it('keeps a current draft usable and lets the user apply it', async () => {
  const { view, cleanup } = await setup();
  fireEvent.click(view.getByText('search.ui.filtersTitle'));
  fireEvent.change(view.getByLabelText('search.filters.from'), {
    target: { value: 'current@example.test' },
  });
  fireEvent.click(view.getByLabelText('apply-filter'));
  expect(mockOptions.from).toBe('current@example.test');
  expect(view.queryByLabelText('apply-filter')).toBeNull();
  cleanup();
});

it('keeps a stale draft hidden and blocked after A to B to A', async () => {
  const { view, change, cleanup } = await setup();
  fireEvent.click(view.getByText('search.ui.filtersTitle'));
  fireEvent.change(view.getByLabelText('search.filters.from'), {
    target: { value: 'private@example.test' },
  });
  const oldApply = mockApply;
  change('session-b');
  change('session-a');
  expect(view.queryByDisplayValue('private@example.test')).toBeNull();
  expect((view.getByLabelText('apply-filter') as HTMLButtonElement).disabled).toBe(true);
  expect(view.getByText('search.ui.filterDraftUnavailable').getAttribute('aria-live')).toBe(
    'polite',
  );
  act(() => oldApply?.());
  expect(mockOptions.from).toBeUndefined();
  cleanup();
});

it('does not let old apply, close, input or quick-filter callbacks alter a new B draft', async () => {
  const { view, change, cleanup } = await setup();
  const oldQuick = mockQuick;
  fireEvent.click(view.getByText('search.ui.filtersTitle'));
  fireEvent.change(view.getByLabelText('search.filters.from'), {
    target: { value: 'private@example.test' },
  });
  const oldApply = mockApply;
  const oldClose = mockClose;
  const oldFrom = mockFromChange;
  change('session-b');
  fireEvent.click(view.getByLabelText('close-filter'));
  fireEvent.click(view.getByText('search.ui.filtersTitle'));
  fireEvent.change(view.getByLabelText('search.filters.from'), {
    target: { value: 'current@example.test' },
  });
  act(() => {
    oldFrom?.('old@example.test');
    oldQuick?.(true);
    oldApply?.();
    oldClose?.();
  });
  expect((view.getByLabelText('search.filters.from') as HTMLInputElement).value).toBe(
    'current@example.test',
  );
  expect(mockOptions.from).toBeUndefined();
  expect(mockOptions.hasAttachment).toBeUndefined();
  fireEvent.click(view.getByLabelText('apply-filter'));
  expect(mockOptions.from).toBe('current@example.test');
  cleanup();
});

it('uses the latest filter text when editing and applying in the same React batch', async () => {
  const { view, cleanup } = await setup();
  fireEvent.click(view.getByText('search.ui.filtersTitle'));
  act(() => {
    mockFromChange?.('latest@example.test');
    mockApply?.();
  });
  expect(mockOptions.from).toBe('latest@example.test');
  cleanup();
});

it('keeps the current draft across a same-session token refresh', async () => {
  const { view, cleanup } = await setup();
  fireEvent.click(view.getByText('search.ui.filtersTitle'));
  fireEvent.change(view.getByLabelText('search.filters.from'), {
    target: { value: 'current@example.test' },
  });
  const refreshed = `e30.${Buffer.from(JSON.stringify({ userId: 'alice', sessionId: 'session-a', exp: 2000000000, jti: 'refresh' })).toString('base64url')}.fixture`;
  act(() => mockOxy.session.setAccessToken(refreshed));
  expect((view.getByLabelText('search.filters.from') as HTMLInputElement).value).toBe(
    'current@example.test',
  );
  fireEvent.click(view.getByLabelText('apply-filter'));
  expect(mockOptions.from).toBe('current@example.test');
  cleanup();
});

it('hides a draft when an initially null projected session becomes known', async () => {
  const { view, cleanup } = await setup();
  act(() => mockRuntime.setActiveSessionId(null));
  fireEvent.click(view.getByText('search.ui.filtersTitle'));
  fireEvent.change(view.getByLabelText('search.filters.from'), {
    target: { value: 'private@example.test' },
  });
  act(() => mockRuntime.setActiveSessionId('session-a'));
  expect(view.queryByDisplayValue('private@example.test')).toBeNull();
  expect((view.getByLabelText('apply-filter') as HTMLButtonElement).disabled).toBe(true);
  expect(view.getByText('search.ui.filterDraftUnavailable')).toBeTruthy();
  cleanup();
});

it('keeps the committed A draft usable during a suspended runtime replacement', async () => {
  const { view, client, cleanup } = await setup();
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
  fireEvent.click(current.getByText('search.ui.filtersTitle'));
  fireEvent.change(current.getByLabelText('search.filters.from'), {
    target: { value: 'current@example.test' },
  });
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
  expect((current.getByLabelText('search.filters.from') as HTMLInputElement).value).toBe(
    'current@example.test',
  );
  fireEvent.click(current.getByLabelText('apply-filter'));
  expect(current.getByText('search.filters.from: current@example.test')).toBeTruthy();
  current.unmount();
  mockRuntime = oldRuntime;
  cleanup();
});

it('applies a current filter after StrictMode effect replay', async () => {
  const { view, cleanup } = await setup(true);
  fireEvent.click(view.getByText('search.ui.filtersTitle'));
  fireEvent.change(view.getByLabelText('search.filters.from'), {
    target: { value: 'current@example.test' },
  });
  fireEvent.click(view.getByLabelText('apply-filter'));
  expect(mockOptions.from).toBe('current@example.test');
  cleanup();
});

it('does not apply when the owner changes before React commits the new screen', async () => {
  const { view, cleanup } = await setup();
  fireEvent.click(view.getByText('search.ui.filtersTitle'));
  fireEvent.change(view.getByLabelText('search.filters.from'), {
    target: { value: 'private@example.test' },
  });
  const oldApply = mockApply;
  act(() => {
    mockOxy.session.setAccessToken(token('session-b'));
    mockRuntime.setActiveSessionId('session-b');
    oldApply?.();
  });
  expect(mockOptions.from).toBeUndefined();
  expect(view.queryByDisplayValue('private@example.test')).toBeNull();
  cleanup();
});

it('does not revive an old draft after runtime replacement A to B to A', async () => {
  const { view, tree, cleanup } = await setup();
  fireEvent.click(view.getByText('search.ui.filtersTitle'));
  fireEvent.change(view.getByLabelText('search.filters.from'), {
    target: { value: 'private@example.test' },
  });
  const oldApply = mockApply;
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
  expect(view.queryByDisplayValue('private@example.test')).toBeNull();
  mockRuntime = oldRuntime;
  view.rerender(tree());
  expect(view.queryByDisplayValue('private@example.test')).toBeNull();
  act(() => oldApply?.());
  expect(mockOptions.from).toBeUndefined();
  cleanup();
});

it('does not let an old input callback edit a later draft in the same session', async () => {
  const { view, cleanup } = await setup();
  fireEvent.click(view.getByText('search.ui.filtersTitle'));
  const oldFrom = mockFromChange;
  const oldClear = mockClear;
  fireEvent.click(view.getByLabelText('close-filter'));
  fireEvent.click(view.getByText('search.ui.filtersTitle'));
  fireEvent.change(view.getByLabelText('search.filters.from'), {
    target: { value: 'current@example.test' },
  });
  act(() => {
    oldFrom?.('old@example.test');
    oldClear?.();
  });
  expect((view.getByLabelText('search.filters.from') as HTMLInputElement).value).toBe(
    'current@example.test',
  );
  cleanup();
});

it('blocks an invalid typed calendar date until corrected', async () => {
  const { input, view, cleanup } = await setup();
  fireEvent.change(input, { target: { value: 'after:2026-02-30' } });
  expect(mockSearchEnabled).toBe(false);
  expect(view.getByText('search.ui.invalidDate')).toBeTruthy();
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(mockOptions.dateAfter).toBe('2026-02-30');
  fireEvent.change(input, { target: { value: 'after:2026-02-28' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(mockSearchEnabled).toBe(true));
  expect(mockOptions.dateAfter).toBe(new Date(2026, 1, 28).toISOString());
  cleanup();
});

it('rejects an invalid calendar date from the AI response', async () => {
  const { view, pending, submit, cleanup } = await setup();
  await submit();
  await act(async () => {
    pending[0]({ query: { after: '2026-02-30' }, interpretation: 'AI date' });
  });
  await waitFor(() => expect(view.getByText('search.nl.searchingFor')).toBeTruthy());
  expect(mockOptions.q).toBe('project discussion');
  expect(mockOptions.dateAfter).toBeUndefined();
  cleanup();
});

it('preserves a valid year below 100 from the AI response', async () => {
  const { pending, submit, cleanup } = await setup();
  await submit();
  await act(async () => {
    pending[0]({ query: { after: '0099-02-28' }, interpretation: 'AI date' });
  });
  const local = new Date(0);
  local.setHours(0, 0, 0, 0);
  local.setFullYear(99, 1, 28);
  await waitFor(() => expect(mockOptions.dateAfter).toBe(local.toISOString()));
  cleanup();
});

it('blocks an invalid saved filter while keeping the original value', async () => {
  const { view, cleanup } = await setup();
  act(() => mockApplySaved?.({ query: '', filters: { dateAfter: '2026-02-30' } }));
  expect(mockOptions.dateAfter).toBe('2026-02-30');
  expect(mockSearchEnabled).toBe(false);
  expect(view.getByText('search.ui.invalidDate')).toBeTruthy();
  expect(view.getByText(/2026-02-30/)).toBeTruthy();
  fireEvent.click(view.getByLabelText('remove-chip'));
  expect(view.queryByText('search.ui.invalidDate')).toBeNull();
  cleanup();
});

it('does not start AI interpretation while an invalid saved date is active', async () => {
  const { input, post, cleanup } = await setup();
  act(() => mockApplySaved?.({ query: '', filters: { dateAfter: '2026-02-30' } }));
  fireEvent.change(input, { target: { value: 'project discussion' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(post).not.toHaveBeenCalled();
  expect(mockSearchEnabled).toBe(false);
  cleanup();
});

it('does not apply an older AI interpretation after an invalid saved date is applied', async () => {
  const { view, pending, submit, cleanup } = await setup();
  await submit();
  act(() => mockApplySaved?.({ query: '', filters: { dateAfter: '2026-02-30' } }));
  await act(async () => {
    pending[0]({ query: { from: 'old@example.test' }, interpretation: 'old result' });
  });
  expect(view.queryByText('old result')).toBeNull();
  expect(mockOptions.from).toBeUndefined();
  expect(mockOptions.dateAfter).toBe('2026-02-30');
  expect(mockSearchEnabled).toBe(false);
  cleanup();
});

it('hides prior results immediately during the invalid input debounce', async () => {
  const { view, input, tree, cleanup } = await setup();
  mockSearchData = {
    pages: [{ data: [], unreadable: [{ _id: 'old' }], pagination: { total: 1 } }],
  };
  view.rerender(tree());
  expect(mockRenderedItems).toHaveLength(1);
  fireEvent.change(input, { target: { value: 'after:2026-02-30' } });
  expect(mockSearchEnabled).toBe(false);
  expect(mockRenderedItems).toHaveLength(0);
  mockSearchData = {
    pages: [{ data: [], unreadable: [{ _id: 'late' }], pagination: { total: 1 } }],
  };
  view.rerender(tree());
  expect(mockRenderedItems).toHaveLength(0);
  cleanup();
});

it('does not start a search for an invalid date and hides an older late response', async () => {
  mockUseRealSearch = true;
  const requests: ((value: unknown) => void)[] = [];
  const search = jest.fn(() => new Promise((resolve) => requests.push(resolve)));
  useEmailStore.setState({ _api: { search } as never });
  const { input, cleanup } = await setup();
  fireEvent.change(input, { target: { value: 'from:alice' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
  fireEvent.change(input, { target: { value: 'from:alice after:2026-02-30' } });
  expect(mockSearchEnabled).toBe(false);
  await act(() => new Promise((resolve) => setTimeout(resolve, 350)));
  expect(search).toHaveBeenCalledTimes(1);
  await act(async () => {
    requests[0]({ data: [], unreadable: [{ _id: 'late' }], pagination: { total: 1 } });
  });
  expect(mockRenderedItems).toHaveLength(0);
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(search).toHaveBeenCalledTimes(1);
  fireEvent.change(input, { target: { value: 'from:alice after:2026-02-28' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(search).toHaveBeenCalledTimes(2));
  cleanup();
});
