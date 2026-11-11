import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { OxyServices } from '@oxy.so/core';
import { createInboxQueryClient } from '@/hooks/queries/queryClient';
import { useEmailStore } from '@/hooks/useEmail';
import { wireMessage } from '../fixtures/wire';

let mockOxy: OxyServices;
const mockMarkRead = false;
let mockRuntime: ReturnType<typeof import('@oxy.so/services/runtime').useOxyRuntime>;
const mockToast = jest.fn();
const mockTranslate = (s: string) => s;
const mockMessage = wireMessage({ _id: 'synthetic-message', id: 'synthetic-message' });
jest.mock('@oxy.so/services/runtime', () => ({ useOxyRuntime: () => mockRuntime }));
jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({ oxyServices: mockOxy, user: { id: 'alice' } }),
}));
jest.mock('@oxy.so/bloom/toast', () => ({ toast: { error: mockToast, success: jest.fn() } }));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: mockTranslate, locale: 'en' }) }));
jest.mock('react-native', () => ({
  Platform: { OS: 'web', select: (v: { web?: unknown; default?: unknown }) => v.web ?? v.default },
  StyleSheet: { create: (v: unknown) => v, hairlineWidth: 1 },
  View: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  usePathname: () => '/',
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('expo-print', () => ({}));
jest.mock('@oxy.so/bloom/styles', () => ({ tokens: { space: {}, radius: {}, font: {} } }));
jest.mock('@oxy.so/bloom/screen', () => ({
  Screen: ({ header, children }: { header: React.ReactNode; children: React.ReactNode }) => (
    <>
      {header}
      {children}
    </>
  ),
  ScreenScrollView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@oxy.so/bloom/theme', () => ({ useTheme: () => ({ colors: {} }) }));
jest.mock('@oxy.so/bloom/app-shell', () => ({ useAppShell: () => ({ drawerAvailable: false }) }));
jest.mock('@oxy.so/bloom/page-header', () => ({
  PageHeader: ({ leading, actions }: { leading?: React.ReactNode; actions: React.ReactNode }) => (
    <>
      {leading}
      {actions}
    </>
  ),
}));
jest.mock('@oxy.so/bloom/button-group', () => ({
  ButtonGroup: ({ children }: { children: React.ReactNode }) => children,
  ButtonGroupItem: ({
    accessibilityLabel,
    onPress,
    disabled,
  }: {
    accessibilityLabel: string;
    onPress: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" aria-label={accessibilityLabel} onClick={onPress} disabled={disabled} />
  ),
}));
jest.mock('@oxy.so/bloom/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useDialogControl: () => ({ open: jest.fn(), close: jest.fn() }),
}));
jest.mock('@/hooks/queries/useMessage', () => ({ useMessage: () => ({ data: mockMessage }) }));
jest.mock('@/hooks/queries/useThread', () => ({
  useThread: () => ({ data: { messages: [], unreadable: [] }, isPending: false }),
}));
jest.mock('@/hooks/queries/useLabels', () => ({ useLabels: () => ({ data: [] }) }));
jest.mock('@/hooks/queries/useMailboxes', () => ({ useMailboxes: () => ({ data: [] }) }));
jest.mock('@/hooks/queries/useSentimentAnalysis', () => ({ useSentimentAnalysis: () => null }));
jest.mock('@/hooks/queries/useStaleThread', () => ({ useStaleThread: () => null }));
jest.mock('@/hooks/useCidResolver', () => ({ useCidResolver: () => ({}) }));
jest.mock('@/hooks/useGoBack', () => ({ useGoBack: () => jest.fn() }));
jest.mock('@/hooks/useLeaveRemovedRows', () => ({ useLeaveOpenConversation: () => jest.fn() }));
jest.mock('@/hooks/useOpenAttachment', () => ({ useOpenAttachment: () => jest.fn() }));
jest.mock('@/contexts/inbox-prefs-context', () => ({
  useInboxPrefs: () => ({ prefs: { markReadOnOpen: mockMarkRead } }),
}));
jest.mock('@/constants/theme', () => ({ useColors: () => ({}) }));
jest.mock('@/components/DeliveryStatus', () => ({
  DeliveryNotice: () => null,
  useDeliveryLabel: () => jest.fn(),
}));
jest.mock('@oxy.so/bloom/page-footer', () => ({ PageFooter: () => null }));
jest.mock('@oxy.so/bloom/card', () => ({ Card: () => null, CardBody: () => null }));
jest.mock('@oxy.so/bloom/empty-state', () => ({ EmptyState: () => null }));
jest.mock('@oxy.so/bloom/typography', () => ({ Text: () => null }));
jest.mock('@oxy.so/bloom/button', () => ({
  Button: ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) => (
    <button type="button" onClick={onPress}>
      {children}
    </button>
  ),
  IconButton: () => null,
}));
jest.mock('@oxy.so/bloom/checkbox', () => ({ Checkbox: () => null }));
jest.mock('@oxy.so/bloom/mail-thread', () => ({ MailMessage: () => null, MailThread: () => null }));
jest.mock('@oxy.so/bloom/loading', () => ({ Loading: () => null }));
jest.mock('@/components/CreateReminderSheet', () => ({
  CreateReminderSheet: ({
    visible,
    onClose,
    onCreate,
    unavailableMessage,
  }: {
    visible: boolean;
    onClose: () => void;
    onCreate: (text: string, at: Date) => Promise<void>;
    unavailableMessage?: string;
  }) =>
    visible ? (
      <section aria-label="synthetic create editor">
        <p>{unavailableMessage}</p>
        <button type="button" onClick={onClose}>
          close editor
        </button>
        <button
          type="button"
          disabled={!!unavailableMessage}
          onClick={() => {
            void onCreate('Synthetic draft', new Date('2030-01-01T00:00:00.000Z')).catch(() => {});
          }}
        >
          save editor
        </button>
      </section>
    ) : null,
}));
jest.mock('@/components/HtmlBody', () => ({ HtmlBody: () => null }));
jest.mock('@/components/InlineReply', () => ({ InlineReply: () => null }));
jest.mock('@/components/SnoozeSheet', () => ({ SnoozeSheet: () => null }));
jest.mock('@/components/StaleThreadBanner', () => ({ StaleThreadBanner: () => null }));
jest.mock('@/components/ThreadOverview', () => ({ ThreadOverview: () => null }));
jest.mock('@/components/UnreadableThreadEntry', () => ({ UnreadableThreadEntry: () => null }));
jest.mock('@/components/cards/CardRenderer', () => ({ CardRenderer: () => null }));
jest.mock('@/components/EmptyStateSticker', () => ({ EmptyStateSticker: () => null }));

jest.mock('@/utils/saveEml', () => ({ emlFilename: () => 'test.eml', saveEmlFile: jest.fn() }));
import { MessageDetail } from '@/components/MessageDetail';

function token(session: string) {
  return `e30.${Buffer.from(JSON.stringify({ userId: 'alice', sessionId: session, exp: 2000000000 })).toString('base64url')}.fixture`;
}
let previousFetch: typeof fetch;
beforeEach(() => {
  jest.clearAllMocks();
  previousFetch = globalThis.fetch;
  mockOxy = new OxyServices({
    baseURL: 'https://api.test',
    enableRetry: false,
    enableCache: false,
  });
  mockOxy.session.setAccessToken(token('a-session'));
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
  useEmailStore.getState()._initApi(mockOxy.http);
});
afterEach(() => {
  useEmailStore.getState().resetAccountScopedState();
  mockOxy.dispose();
  globalThis.fetch = previousFetch;
});
it('blocks a create editor opened before a same-subject session change', async () => {
  globalThis.fetch = jest.fn() as never;
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <MessageDetail mode="embedded" messageId="synthetic-message" />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'reminder.create.title' }));
  expect(screen.getByRole('region', { name: 'synthetic create editor' })).toBeTruthy();
  act(() => {
    mockOxy.session.setAccessToken(token('new-session'));
    mockRuntime.setActiveSessionId('new-session');
  });
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: 'save editor' }) as HTMLButtonElement).disabled,
    ).toBe(true),
  );
  expect(screen.getByText('ui.mutations.reminderEditorUnavailable')).toBeTruthy();
  expect(globalThis.fetch).not.toHaveBeenCalled();
  view.unmount();
  client.clear();
});
it('does not close a new create editor after the prior request succeeds', async () => {
  let release!: (value: unknown) => void, begin!: () => void;
  const pending = new Promise<unknown>((r) => {
    release = r;
  });
  const started = new Promise<void>((r) => {
    begin = r;
  });
  globalThis.fetch = jest.fn(async () => {
    begin();
    return pending;
  }) as never;
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <MessageDetail mode="embedded" messageId="synthetic-message" />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'reminder.create.title' }));
  fireEvent.click(screen.getByRole('button', { name: 'save editor' }));
  await started;
  fireEvent.click(screen.getByRole('button', { name: 'close editor' }));
  fireEvent.click(screen.getByRole('button', { name: 'reminder.create.title' }));
  const at = '2030-01-01T00:00:00.000Z';
  const body = {
    data: {
      _id: 'synthetic',
      userId: 'alice',
      text: 'Synthetic draft',
      remindAt: at,
      completed: false,
      pinned: false,
      createdAt: at,
      updatedAt: at,
    },
  };
  await act(async () =>
    release({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => 'application/json' },
      json: async () => body,
      text: async () => JSON.stringify(body),
      clone() {
        return this;
      },
    }),
  );
  await waitFor(() =>
    expect(client.getMutationCache().getAll().at(-1)?.state.status).toBe('success'),
  );
  expect(screen.getByRole('region', { name: 'synthetic create editor' })).toBeTruthy();
  view.unmount();
  client.clear();
});
