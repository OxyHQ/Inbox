import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useCurrentList } from '@/hooks/useCurrentList';
import { useBundles } from '@/hooks/queries/useBundles';
import { useEmailStore } from '@/hooks/useEmail';
import { emailKeys } from '@/hooks/queries/queryKeys';
import { MessageSchema } from '@/schemas/emailSchemas';
import { wireMessage } from '../fixtures/wire';

let mockAccount = {
  user: { id: 'a' },
  canUsePrivateApi: false,
  isAccountCacheReady: false,
  oxyServices: { http: {} },
};
const mockMailboxes = jest.fn();
const mockMessages = jest.fn();
const mockBundles = jest.fn();
jest.mock('@oxy.so/services/ui/client', () => ({ useOxy: () => mockAccount }));
jest.mock('@/services/emailApi', () => ({
  createEmailApi: () => ({
    listMailboxes: mockMailboxes,
    listMessages: mockMessages,
    listBundles: mockBundles,
  }),
}));
jest.mock('@/hooks/useInboxDisplayPrefs', () => ({
  useInboxDisplayPrefs: () => ({ conversationView: false }),
}));

const mailbox = { _id: 'inbox-a', specialUse: '\\Inbox', name: 'Inbox' };
const message = MessageSchema.parse(wireMessage({ _id: 'message-a', mailboxId: mailbox._id }));
const page = { data: [message], pagination: { hasMore: false, limit: 50, offset: 0, total: 1 } };
let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } });
  useEmailStore.getState().resetAccountScopedState();
  mockAccount = {
    ...mockAccount,
    user: { id: 'a' },
    canUsePrivateApi: false,
    isAccountCacheReady: false,
  };
  mockMailboxes.mockReset().mockResolvedValue([mailbox]);
  mockMessages.mockReset().mockResolvedValue(page);
  mockBundles.mockReset().mockResolvedValue([]);
});
afterEach(() => client.clear());

it('starts the cold mailbox read at SDK readiness without a drawer API initialization effect', async () => {
  const view = renderHook(() => useCurrentList(), { wrapper });
  expect(mockMailboxes).not.toHaveBeenCalled();
  mockAccount.canUsePrivateApi = true;
  view.rerender();
  expect(mockMailboxes).not.toHaveBeenCalled();
  mockAccount.isAccountCacheReady = true;
  view.rerender();
  await waitFor(() => expect(view.result.current.messages).toEqual([message]));
  expect(useEmailStore.getState()._api).toBeNull();
  expect(mockMailboxes).toHaveBeenCalledTimes(1);
  expect(mockMessages).toHaveBeenCalledTimes(1);
});

it('reveals the restored list immediately and never exposes disabled shared-key cache', () => {
  client.setQueryData(emailKeys.mailboxes.list('a'), [mailbox]);
  client.setQueryData(emailKeys.messages.list({ mailboxId: mailbox._id, userId: 'a' }), {
    pages: [page],
    pageParams: [''],
  });
  client.setQueryData(emailKeys.bundles, [{ _id: 'private-bundle-a' }]);
  const view = renderHook(() => ({ list: useCurrentList(), bundles: useBundles() }), { wrapper });
  expect(view.result.current.list.messages).toEqual([]);
  expect(view.result.current.bundles.data).toBeUndefined();
  act(() => {
    mockAccount.canUsePrivateApi = true;
    mockAccount.isAccountCacheReady = true;
  });
  view.rerender();
  expect(view.result.current.list.messages).toEqual([message]);
  expect(view.result.current.bundles.data).toEqual([{ _id: 'private-bundle-a' }]);
  expect(mockMailboxes).not.toHaveBeenCalled();
  expect(mockMessages).not.toHaveBeenCalled();
  mockAccount = { ...mockAccount, user: { id: 'b' }, isAccountCacheReady: false };
  view.rerender();
  expect(view.result.current.list.messages).toEqual([]);
  expect(view.result.current.bundles.data).toBeUndefined();
});
