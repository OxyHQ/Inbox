import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';

const mockSave = jest.fn();
const mockApi = { getSettings: jest.fn(), saveDraft: mockSave };
const mockHttp = {
  getSessionEpoch: () => 0,
  getAccessToken: () => 'fixture',
  addTokenChangeListener: () => () => undefined,
};
const mockStorage = new Map<string, string>();
const mockSession = { userId: 'user-1' };
const mockTranslate = (key: string) => key;

jest.mock('@/hooks/useEmail', () => ({
  useEmailStore: Object.assign((selector: (s: unknown) => unknown) => selector({ _api: mockApi }), {
    getState: () => ({ _api: mockApi }),
  }),
}));
jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({
    user: { id: 'user-1', username: 'nate' },
    oxyServices: { http: mockHttp, session: mockSession },
  }),
}));
jest.mock('@/hooks/mutations/useMessageMutations', () => ({
  useSaveDraft: jest.requireActual('@/hooks/mutations/useMessageMutations').useSaveDraft,
  useSendMessageWithUndo: () => ({ sendWithUndo: jest.fn(), isPending: false }),
  useSendMessage: () => ({ mutate: jest.fn(), isPending: false }),
  useDiscardDraft: () => ({ mutateAsync: jest.fn() }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: mockTranslate }) }));
jest.mock('@oxy.so/bloom/toast', () => ({ toast: Object.assign(jest.fn(), { error: jest.fn() }) }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: async (key: string) => mockStorage.get(key) ?? null,
    setItem: async (key: string, value: string) => void mockStorage.set(key, value),
    removeItem: async (key: string) => void mockStorage.delete(key),
  },
}));

import { useComposeSession } from '@/hooks/useComposeSession';

it('does not postpone autosave when the composer rerenders without an edit', async () => {
  jest.useFakeTimers();
  mockStorage.clear();
  mockApi.getSettings.mockResolvedValue({ signature: '' });
  mockSave.mockResolvedValue({ _id: 'draft', draftRevision: 1 });
  const client = new QueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  const options = {
    recoveryIdentity: 'new',
    awaitingReplyHeaders: false,
    insertSignature: false,
    onFinished: jest.fn(),
  };
  const { result, rerender, unmount } = renderHook(() => useComposeSession(options), {
    wrapper: Wrapper,
  });
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
  act(() => result.current.setSubject('draft'));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(4000);
  });
  rerender();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(4000);
  });
  expect(mockSave).toHaveBeenCalledTimes(1);
  unmount();
  client.clear();
  jest.useRealTimers();
});
