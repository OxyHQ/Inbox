import React from 'react';
import { render } from '@testing-library/react';
import { InboxBottomBar } from '@/components/InboxBottomBar';

const mockNavigate = jest.fn();
const mockPush = jest.fn();
const mockSettings = jest.fn();
const mockFocus = jest.fn();
let mockBar: any;
let mockKeyboard = false;
let mockSelecting = false;
let mockAuthenticated = true;
jest.mock('expo-router', () => ({
  usePathname: () => '/search',
  useRouter: () => ({ navigate: mockNavigate, push: mockPush }),
}));
jest.mock('react-native-keyboard-controller', () => ({
  useKeyboardState: (selector: any) => selector({ isVisible: mockKeyboard }),
}));
jest.mock('@oxy.so/bloom/bottom-bar', () => ({
  BottomBar: (props: any) => {
    mockBar = props;
    return null;
  },
}));
jest.mock('@oxy.so/bloom/fab', () => ({ Fab: () => null }));
jest.mock(
  '@oxy.so/bloom/icons',
  () => new Proxy({}, { get: () => () => null }),
);
jest.mock('@oxy.so/services', () => ({
  useOxy: () => ({ isAuthenticated: mockAuthenticated }),
}));
jest.mock('@/components/settings/InboxSettings', () => ({
  useInboxSettings: () => mockSettings,
}));
jest.mock('@/contexts/search-focus-context', () => ({
  useSearchFocus: () => ({ focusInput: mockFocus }),
}));
jest.mock('@/hooks/useEmail', () => ({
  useEmailStore: (selector: any) =>
    selector({ isSelectionMode: mockSelecting }),
}));
jest.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockBar = null;
  mockKeyboard = false;
  mockSelecting = false;
  mockAuthenticated = true;
});
it('opens settings without replacing the current mailbox route', () => {
  render(<InboxBottomBar />);
  expect(mockBar.value).toBe('search');
  mockBar.onValueChange('settings');
  expect(mockSettings).toHaveBeenCalledTimes(1);
  expect(mockNavigate).not.toHaveBeenCalled();
});
it('preserves search focusing, inbox navigation and the compose action', () => {
  render(<InboxBottomBar />);
  mockBar.onValueChange('search');
  expect(mockNavigate).toHaveBeenLastCalledWith('/search');
  expect(mockFocus).toHaveBeenCalledTimes(1);
  mockBar.onValueChange('inbox');
  expect(mockNavigate).toHaveBeenLastCalledWith('/');
  mockBar.action.props.onPress();
  expect(mockPush).toHaveBeenCalledWith('/compose');
});
it('hides compose during selection and while signed out', () => {
  mockSelecting = true;
  const { rerender } = render(<InboxBottomBar />);
  expect(mockBar.action).toBeUndefined();
  mockSelecting = false;
  mockAuthenticated = false;
  rerender(<InboxBottomBar />);
  expect(mockBar.action).toBeUndefined();
});
it('hides navigation while the keyboard is showing', () => {
  mockKeyboard = true;
  render(<InboxBottomBar />);
  expect(mockBar).toBeNull();
});
