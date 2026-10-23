import LabelViewRoute from '@/app/(drawer)/(tabs)/(inbox)/label/[name]';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

let mockReady = false;
let mockFocused = true;
let mockLabels: { _id: string; name: string }[] | undefined;
let mockSuccess = false;
const mockSelect = jest.fn();
jest.mock('expo-router', () => ({
  useIsFocused: () => mockFocused,
  useLocalSearchParams: () => ({ name: 'Receipts' }),
  Redirect: ({ href }: { href: string }) => <a href={href}>Return to Inbox</a>,
}));
jest.mock('expo-router/head', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({ canUsePrivateApi: mockReady, isAccountCacheReady: mockReady }),
}));
jest.mock('@/hooks/queries/useLabels', () => ({
  useLabels: () => ({ data: mockLabels, isSuccess: mockSuccess }),
}));
jest.mock('@/hooks/useEmail', () => ({
  useEmailStore: (select: (state: unknown) => unknown) => select({ selectLabel: mockSelect }),
}));
jest.mock('@/components/MessageDetailEmpty', () => ({ MessageDetailEmpty: () => <main /> }));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

beforeEach(() => {
  mockReady = false;
  mockFocused = true;
  mockLabels = undefined;
  mockSuccess = false;
  mockSelect.mockClear();
});

it('waits for the current account and successful labels before leaving an unknown label', () => {
  const view = render(<LabelViewRoute />);
  expect(screen.queryByRole('link')).toBeNull();
  mockSuccess = true;
  mockLabels = [];
  view.rerender(<LabelViewRoute />);
  expect(screen.queryByRole('link')).toBeNull();
  mockReady = true;
  mockSuccess = false;
  view.rerender(<LabelViewRoute />);
  expect(screen.queryByRole('link')).toBeNull();
  mockSuccess = true;
  view.rerender(<LabelViewRoute />);
  expect(screen.getByRole('link').getAttribute('href')).toBe('/');
});

it('selects a resolved label without creating a second list or redirecting', () => {
  mockReady = true;
  mockSuccess = true;
  mockLabels = [{ _id: 'receipts', name: 'receipts' }];
  render(<LabelViewRoute />);
  expect(mockSelect).toHaveBeenCalledWith('receipts', 'receipts');
  expect(screen.queryByRole('link')).toBeNull();
});

it('does not navigate from a retained label route behind the current screen', () => {
  mockReady = true;
  mockSuccess = true;
  mockLabels = [];
  mockFocused = false;
  render(<LabelViewRoute />);
  expect(screen.queryByRole('link')).toBeNull();
});
