import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { OxyServices } from '@oxy.so/core';
import { createInboxQueryClient } from '@/hooks/queries/queryClient';
import { useEmailStore } from '@/hooks/useEmail';
import { wireMessage } from '../fixtures/wire';

let mockOxy: OxyServices;
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
  Screen: ({ header }: { header: React.ReactNode }) => header,
  ScreenScrollView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@oxy.so/bloom/theme', () => ({ useTheme: () => ({ colors: {} }) }));
jest.mock('@oxy.so/bloom/app-shell', () => ({ useAppShell: () => ({ drawerAvailable: false }) }));
jest.mock('@oxy.so/bloom/page-header', () => ({
  PageHeader: ({ actions }: { actions: React.ReactNode }) => actions,
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
  Dialog: {},
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
jest.mock('@/hooks/useMessageActions', () => ({
  useMessageActions: () => ({ isArchived: () => false }),
}));
jest.mock('@/hooks/mutations/useReminderMutations', () => ({ useCreateReminder: () => ({}) }));
jest.mock('@/contexts/inbox-prefs-context', () => ({
  useInboxPrefs: () => ({ prefs: { markReadOnOpen: false } }),
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
jest.mock('@oxy.so/bloom/button', () => ({ Button: () => null, IconButton: () => null }));
jest.mock('@oxy.so/bloom/checkbox', () => ({ Checkbox: () => null }));
jest.mock('@oxy.so/bloom/mail-thread', () => ({ MailMessage: () => null, MailThread: () => null }));
jest.mock('@oxy.so/bloom/loading', () => ({ Loading: () => null }));
jest.mock('@/components/CreateReminderSheet', () => ({ CreateReminderSheet: () => null }));
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

it('reports that the current account is not ready from the real message star button', async () => {
  mockOxy = new OxyServices({
    baseURL: 'https://api.test',
    enableRetry: false,
    enableCache: false,
  });
  const payload = Buffer.from(
    JSON.stringify({ userId: 'alice', sessionId: 'a', exp: 2000000000 }),
  ).toString('base64url');
  mockOxy.session.setAccessToken(`e30.${payload}.fixture`);
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
  mockRuntime.setAccount({ id: 'alice' });
  const client = createInboxQueryClient();
  useEmailStore.getState().resetAccountScopedState();
  const spy = jest.spyOn(mockOxy.http, 'put').mockResolvedValue(mockMessage);
  const view = render(
    <QueryClientProvider client={client}>
      <MessageDetail mode="embedded" messageId="synthetic-message" />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'message.actions.star' }));
  expect(mockToast).toHaveBeenCalledWith('ui.mutations.starSessionUnavailable');
  expect(spy).not.toHaveBeenCalled();
  await waitFor(() => expect(client.getMutationCache().getAll()[0]?.state.status).toBe('error'));
  act(() => useEmailStore.getState()._initApi(mockOxy.http));
  fireEvent.click(screen.getByRole('button', { name: 'message.actions.star' }));
  await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
  view.unmount();
  client.clear();
  mockOxy.dispose();
});
