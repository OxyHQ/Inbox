import { InboxBottomBar } from '@/components/InboxBottomBar';
import { render } from '@testing-library/react';
import { defined } from '../fixtures/defined';

const mockNavigate = jest.fn();
const mockPush = jest.fn();
const mockSettings = jest.fn();
const mockFocus = jest.fn();
/** What the suite reads from the props InboxBottomBar hands Bloom's BottomBar. */
interface BarProps {
  value: string;
  onValueChange: (value: string) => void;
  action?: { props: { onPress: () => void } };
}
let mockBar: BarProps | null;
/** The bar's last props; fails the test if the bar was not rendered. */
function mockBarProps(): BarProps {
  if (!mockBar) throw new Error('the bottom bar was not rendered');
  return mockBar;
}
let mockKeyboard = false;
let mockSelecting = false;
let mockAuthenticated = true;
jest.mock('expo-router', () => ({
  usePathname: () => '/search',
  useRouter: () => ({ navigate: mockNavigate, push: mockPush }),
}));
jest.mock('react-native-keyboard-controller', () => ({
  useKeyboardState: (selector: (state: { isVisible: boolean }) => unknown) =>
    selector({ isVisible: mockKeyboard }),
}));
jest.mock('@oxy.so/bloom/bottom-bar', () => ({
  BottomBar: (props: BarProps) => {
    mockBar = props;
    return null;
  },
}));
jest.mock('@oxy.so/bloom/fab', () => ({ Fab: () => null }));
jest.mock('@oxy.so/bloom/icons', () => new Proxy({}, { get: () => () => null }));
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
  useEmailStore: (selector: (state: { isSelectionMode: boolean }) => unknown) =>
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
  expect(mockBarProps().value).toBe('search');
  mockBarProps().onValueChange('settings');
  expect(mockSettings).toHaveBeenCalledTimes(1);
  expect(mockNavigate).not.toHaveBeenCalled();
});
it('preserves search focusing, inbox navigation and the compose action', () => {
  render(<InboxBottomBar />);
  mockBarProps().onValueChange('search');
  expect(mockNavigate).toHaveBeenLastCalledWith('/search');
  expect(mockFocus).toHaveBeenCalledTimes(1);
  mockBarProps().onValueChange('inbox');
  expect(mockNavigate).toHaveBeenLastCalledWith('/');
  defined(mockBarProps().action, 'the compose action').props.onPress();
  expect(mockPush).toHaveBeenCalledWith('/compose');
});
it('hides compose during selection and while signed out', () => {
  mockSelecting = true;
  const { rerender } = render(<InboxBottomBar />);
  expect(mockBarProps().action).toBeUndefined();
  mockSelecting = false;
  mockAuthenticated = false;
  rerender(<InboxBottomBar />);
  expect(mockBarProps().action).toBeUndefined();
});
it('hides navigation while the keyboard is showing', () => {
  mockKeyboard = true;
  render(<InboxBottomBar />);
  expect(mockBar).toBeNull();
});
