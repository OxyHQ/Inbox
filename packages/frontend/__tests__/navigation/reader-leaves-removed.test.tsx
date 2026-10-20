/**
 * Archive, Delete, Spam and Snooze from the reader. In the reading pane beside
 * the list they only went back on a phone: on desktop the pane kept showing
 * the conversation the action had just taken out of the folder, and the next
 * `e` archived a message no longer in it. The pane now follows the selection
 * to the neighbouring conversation, as the list's own actions do.
 */

const mockRouter = { replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
let mockPathname = '/conversation/m2';
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockPathname,
}));

let mockDesktop = true;
jest.mock('@/hooks/useIsDesktopLayout', () => ({ useIsDesktopLayout: () => mockDesktop }));

const row = (id: string, draft = false) => ({ _id: id, flags: { draft } });
const mockRows = [row('m1'), row('m2'), row('m3')];
jest.mock('@/hooks/useCurrentList', () => ({
  useCurrentList: () => ({
    rows: mockRows,
    conversationOf: (id: string) => mockRows.filter((r) => r._id === id),
    viewHref: '/',
  }),
}));

import { renderHook } from '@testing-library/react';

import { useEmailStore } from '@/hooks/useEmail';
import { useLeaveOpenConversation } from '@/hooks/useLeaveRemovedRows';

beforeEach(() => {
  jest.clearAllMocks();
  mockPathname = '/conversation/m2';
  mockDesktop = true;
  useEmailStore.setState({ selectedMessageId: 'm2' });
});

it('moves the reading pane on to the next conversation', () => {
  const { result } = renderHook(() => useLeaveOpenConversation('embedded'));
  result.current(['m2']);

  expect(useEmailStore.getState().selectedMessageId).toBe('m3');
  expect(mockRouter.replace).toHaveBeenCalledWith('/conversation/m3');
  expect(mockRouter.back).not.toHaveBeenCalled();
});

it('closes the pane when the conversation was the only one left', () => {
  mockRows.splice(0, mockRows.length, row('m2'));
  const { result } = renderHook(() => useLeaveOpenConversation('embedded'));
  result.current(['m2']);

  expect(useEmailStore.getState().selectedMessageId).toBeNull();
  expect(mockRouter.replace).toHaveBeenCalledWith('/');
  mockRows.splice(0, mockRows.length, row('m1'), row('m2'), row('m3'));
});

it('returns to the results when the pane was opened from search', () => {
  mockPathname = '/search/conversation/m2';
  const { result } = renderHook(() => useLeaveOpenConversation('embedded'));
  result.current(['m2']);

  expect(useEmailStore.getState().selectedMessageId).toBeNull();
  expect(mockRouter.replace).toHaveBeenCalledWith('/search');
});

it('goes back, full screen', () => {
  mockDesktop = false;
  const { result } = renderHook(() => useLeaveOpenConversation('standalone'));
  result.current(['m2']);

  expect(mockRouter.back).toHaveBeenCalled();
  expect(mockRouter.replace).not.toHaveBeenCalled();
});
