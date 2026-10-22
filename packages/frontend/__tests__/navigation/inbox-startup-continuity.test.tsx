/** Exercise the real list while identity, token, cache and mail resolve separately. */
import { InboxList } from '@/components/InboxList';
import { MessageSchema } from '@/schemas/emailSchemas';
import type { Message } from '@/services/emailApi';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { wireMessage } from '../fixtures/wire';

type Children = { children?: ReactNode };
let mockAuth = {
  user: null as { id: string } | null,
  isAuthenticated: false,
  canUsePrivateApi: false,
  isAccountCacheReady: false,
  isPrivateApiPending: true,
};
let mockMessages: Message[] = [];
let mockLoading = false;
let mockBrief: { summary: string; items: { messageId: string }[] } | undefined;
let mockPrivateFolder: { name: string; _id: string } | null = null;
let mockSelection = false;
const mockNoop = jest.fn();
const mockRefetch = jest.fn(async () => undefined);
const mockPush = jest.fn();
const mockQueryClient = { getQueryData: () => null, invalidateQueries: mockRefetch };
const mockMutation = { mutate: mockNoop, isPending: false };
const mockSelectionIds = new Set<string>();
const mockExpanded = new Set<string>();
const mockTranslate = (key: string) => key;
const mockActions = { isArchived: () => false };

jest.mock('react-native', () => ({
  View: ({ children }: Children) => <div>{children}</div>,
  RefreshControl: () => null,
  StyleSheet: { create: (styles: unknown) => styles },
}));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { createAnimatedComponent: (component: unknown) => component },
}));
jest.mock('@shopify/flash-list', () => ({
  FlashList: ({
    data,
    renderItem,
    ListHeaderComponent,
    ListEmptyComponent,
  }: {
    data: { key?: string; data?: Message }[];
    renderItem: (args: { item: unknown }) => ReactNode;
    ListHeaderComponent?: ReactNode;
    ListEmptyComponent?: (() => ReactNode) | null;
  }) => (
    <section data-testid="mail-rows">
      {ListHeaderComponent}
      {data.length
        ? data.map((item, index) => (
            <div key={item.key ?? item.data?._id ?? index}>{renderItem({ item })}</div>
          ))
        : ListEmptyComponent?.()}
    </section>
  ),
}));
jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => mockAuth,
  OxySignInButton: () => <button type="button">Sign in</button>,
  RequireOxyAuth: ({
    children,
    loadingFallback = null,
    signedOutFallback = null,
  }: Children & {
    loadingFallback?: ReactNode;
    signedOutFallback?: ReactNode;
  }) =>
    mockAuth.canUsePrivateApi && mockAuth.isAccountCacheReady
      ? children
      : mockAuth.isPrivateApiPending || mockAuth.isAuthenticated
        ? loadingFallback
        : signedOutFallback,
}));
jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  useRouter: () => ({ push: mockPush, replace: mockPush }),
}));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => mockQueryClient }));
jest.mock('@oxy.so/bloom/app-shell', () => ({
  useAppShell: () => ({ drawerAvailable: true, openDrawer: mockNoop }),
}));
jest.mock('@oxy.so/bloom/screen', () => ({
  Screen: ({ header, children }: Children & { header?: ReactNode }) => (
    <main>
      {header}
      {children}
    </main>
  ),
}));
jest.mock('@oxy.so/bloom/page-header', () => ({
  PageHeader: ({
    title,
    leading,
    actions,
  }: {
    title: string;
    leading?: ReactNode;
    actions?: ReactNode;
  }) => (
    <header>
      {leading}
      <h1>{title}</h1>
      {actions}
    </header>
  ),
}));
jest.mock('@oxy.so/bloom/typography', () => ({
  Text: ({ children }: Children) => <span>{children}</span>,
}));
jest.mock('@oxy.so/bloom/button-group', () => ({
  ButtonGroup: ({ children }: Children) => <div>{children}</div>,
  ButtonGroupItem: ({
    children,
    accessibilityLabel,
    onPress,
  }: Children & {
    accessibilityLabel?: string;
    onPress?: () => void;
  }) => (
    <button type="button" aria-label={accessibilityLabel} onClick={onPress}>
      {children}
    </button>
  ),
}));
jest.mock('@oxy.so/bloom/empty-state', () => ({ EmptyState: () => <p>Empty mailbox</p> }));
jest.mock('@oxy.so/bloom/toast', () => ({
  toast: { error: (...args: unknown[]) => mockNoop(...args) },
}));
jest.mock('@alia.onl/sdk/avatar', () => ({ AliaAvatarIcon: () => null }));
jest.mock('@/constants/theme', () => ({ useColors: () => ({}) }));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: mockTranslate, locale: 'en' }) }));
jest.mock('@/contexts/inbox-prefs-context', () => ({
  useInboxPrefs: () => ({ prefs: { aiBrief: true, aiCategorization: false } }),
}));
jest.mock('@/hooks/useInboxDisplayPrefs', () => ({
  useInboxDisplayPrefs: () => ({ density: 'comfortable', showPreviews: true }),
}));
jest.mock('@/hooks/useEmail', () => ({
  useEmailStore: (select: (state: unknown) => unknown) =>
    select({
      currentMailbox: mockPrivateFolder,
      viewMode: null,
      selectedMessageId: null,
      isSelectionMode: mockSelection,
      selectedMessageIds: mockSelectionIds,
      expandedBundles: mockExpanded,
      toggleMessageSelection: mockNoop,
      enterSelectionMode: mockNoop,
      clearSelection: mockNoop,
      selectAll: mockNoop,
      toggleBundle: mockNoop,
      bundleView: false,
    }),
}));
jest.mock('@/hooks/useCurrentList', () => ({
  useCurrentList: () => ({
    query: {
      isLoading: mockLoading,
      isError: false,
      refetch: mockRefetch,
      fetchNextPage: mockNoop,
    },
    options: { mailboxId: 'inbox' },
    listReady: true,
    messages: mockMessages,
    rows: mockMessages,
    unreadable: [],
    conversationOf: (id: string) => mockMessages.filter((message) => message._id === id),
  }),
}));
jest.mock('@/hooks/queries/useMailboxes', () => ({
  useMailboxes: () => ({ data: [], refetch: mockRefetch, isError: false }),
}));
jest.mock('@/hooks/queries/useBundles', () => ({ useBundles: () => ({ data: [] }) }));
jest.mock('@/hooks/queries/useReminders', () => ({ useReminders: () => ({ data: { data: [] } }) }));
jest.mock('@/hooks/queries/useDailyBrief', () => ({
  useDailyBrief: () => ({ brief: mockBrief, isLoading: !mockBrief, error: null }),
}));
jest.mock('@/hooks/queries/useSentimentAnalysis', () => ({
  useBatchSentimentAnalysis: () => new Map(),
}));
jest.mock('@/hooks/mutations/useMessageMutations', () => ({
  useTogglePin: () => mockMutation,
  useBulkUpdateFlags: () => mockMutation,
}));
jest.mock('@/hooks/mutations/useReminderMutations', () => ({
  useUpdateReminder: () => mockMutation,
  useDeleteReminder: () => mockMutation,
}));
jest.mock('@/hooks/useMessageActions', () => ({ useMessageActions: () => mockActions }));
jest.mock('@/hooks/useLeaveRemovedRows', () => ({ useLeaveRemovedRows: () => mockNoop }));
jest.mock('@/hooks/useMailboxScrollRestoration', () => ({
  useMailboxScrollRestoration: () => mockNoop,
}));
jest.mock('@/components/MessageRow', () => ({
  MessageRow: ({ message }: { message: Message }) => (
    <article data-message={message._id}>{message.subject}</article>
  ),
}));
jest.mock('@/components/DailyBrief', () => ({
  DailyBrief: () =>
    mockBrief ? (
      <aside data-testid="brief-card">
        {mockBrief.summary}
        {mockBrief.items.map((item) => (
          <article key={item.messageId} data-message={item.messageId}>
            {item.messageId}
          </article>
        ))}
      </aside>
    ) : null,
}));
jest.mock('@/components/SwipeableRow', () => ({
  SwipeableRow: ({ children }: Children) => children,
}));
jest.mock('@/components/BundleRow', () => ({ BundleRow: () => null }));
jest.mock('@/components/EmptyStateSticker', () => ({ EmptyStateSticker: () => null }));
jest.mock('@/components/UndeliveredBanner', () => ({ UndeliveredBanner: () => null }));
jest.mock('@/components/ReminderRow', () => ({ ReminderRow: () => null }));
jest.mock('@/components/UnreadableMessageRow', () => ({ UnreadableMessageRow: () => null }));
jest.mock('@/components/SelectionToolbar', () => ({
  SelectionToolbar: () => <p>Private selection</p>,
}));
jest.mock('@/components/SnoozeSheet', () => ({ SnoozeSheet: () => null }));
jest.mock('@/components/CreateReminderSheet', () => ({ CreateReminderSheet: () => null }));
jest.mock('@/components/InboxAlia', () => ({
  __esModule: true,
  default: () => <p>Private Alia</p>,
}));

function ready(id = 'a') {
  mockAuth = {
    user: { id },
    isAuthenticated: true,
    canUsePrivateApi: true,
    isAccountCacheReady: true,
    isPrivateApiPending: false,
  };
}
function message(id: string) {
  return MessageSchema.parse(wireMessage({ _id: id, subject: `Private message ${id}` }));
}
beforeEach(() => {
  jest.clearAllMocks();
  mockAuth = {
    user: null,
    isAuthenticated: false,
    canUsePrivateApi: false,
    isAccountCacheReady: false,
    isPrivateApiPending: true,
  };
  mockMessages = [message('a')];
  mockBrief = undefined;
  mockPrivateFolder = null;
  mockSelection = false;
  mockLoading = false;
});

it('keeps the real list header through identity, token, cache and delayed messages', () => {
  const view = render(<InboxList />);
  const header = view.container.querySelector('header');
  const heading = view.container.querySelector('h1');
  expect(header).not.toBeNull();
  for (const partial of [
    { user: { id: 'a' }, isAuthenticated: true },
    { canUsePrivateApi: true, isPrivateApiPending: false },
  ]) {
    mockAuth = { ...mockAuth, ...partial };
    view.rerender(<InboxList />);
    expect(view.container.querySelector('header')).toBe(header);
    expect(view.container.querySelector('h1')).toBe(heading);
    expect(view.container.querySelector('[data-message]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'inbox.composeFabLabel' })).toBeNull();
  }
  mockMessages = [];
  mockLoading = true;
  mockAuth.isAccountCacheReady = true;
  view.rerender(<InboxList />);
  expect(view.container.querySelector('h1')).toBe(heading);
  expect(screen.queryByText('Empty mailbox')).toBeNull();
  mockMessages = [message('a')];
  mockLoading = false;
  view.rerender(<InboxList />);
  expect(view.container.querySelector('h1')).toBe(heading);
  expect(screen.getByText('Private message a')).toBeTruthy();
});

it('hides stale rows, brief, folder and selection while the next account restores', () => {
  ready();
  mockBrief = { summary: 'Private summary A', items: [] };
  const view = render(<InboxList />);
  expect(screen.getByText('Private message a')).toBeTruthy();
  mockAuth = { ...mockAuth, user: { id: 'b' }, isAccountCacheReady: false };
  mockPrivateFolder = { _id: 'private-a', name: 'Private folder A' };
  mockSelection = true;
  view.rerender(<InboxList />);
  expect(view.container.textContent).not.toContain('Private');
  expect(view.container.querySelector('[data-message]')).toBeNull();
  mockPrivateFolder = null;
  mockSelection = false;
  mockMessages = [message('b')];
  mockBrief = { summary: 'Private summary B', items: [] };
  ready('b');
  view.rerender(<InboxList />);
  expect(screen.getByText('Private message b')).toBeTruthy();
  expect(screen.queryByText('Private message a')).toBeNull();
  mockAuth = { ...mockAuth, user: null, isAuthenticated: false, canUsePrivateApi: false };
  view.rerender(<InboxList />);
  expect(view.container.textContent).not.toContain('Private');
});

it('moves a resolved brief message into its card exactly once without replacing the header', () => {
  ready();
  mockMessages = [message('a'), message('b')];
  const view = render(<InboxList />);
  const heading = view.container.querySelector('h1');
  mockBrief = { summary: 'Private summary A', items: [{ messageId: 'a' }] };
  view.rerender(<InboxList />);
  expect(view.container.querySelector('h1')).toBe(heading);
  expect(view.container.querySelectorAll('[data-message="a"]')).toHaveLength(1);
  expect(view.container.querySelectorAll('[data-message="b"]')).toHaveLength(1);
  expect(screen.getByTestId('brief-card').querySelector('[data-message="a"]')).not.toBeNull();
});

it('discards an opened private Alia panel on A→B→A', async () => {
  ready();
  const view = render(<InboxList />);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'inbox.askAlia' })));
  expect(screen.getByText('Private Alia')).toBeTruthy();
  ready('b');
  view.rerender(<InboxList />);
  expect(screen.queryByText('Private Alia')).toBeNull();
  ready('a');
  view.rerender(<InboxList />);
  expect(screen.queryByText('Private Alia')).toBeNull();
});
