import { render } from '@testing-library/react';
import type { ReactNode } from 'react';

jest.mock('react-native', () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  StyleSheet: { create: (styles: unknown) => styles },
}));
jest.mock('@oxy.so/bloom/card', () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardBody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock('@oxy.so/bloom/typography', () => ({
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/constants/theme', () => ({
  useColors: () => ({ text: '', danger: '', secondaryText: '' }),
}));
jest.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    locale: 'en-US',
    t: (key: string, params?: { date?: string }) => `${key}:${params?.date ?? ''}`,
  }),
}));

import { BillCard } from '@/components/cards/BillCard';
import { CardDataSchema } from '@/schemas/emailSchemas';

afterEach(() => jest.useRealTimers());

it('does not display a normalized overdue date for an invalid calendar date', () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-03-10T12:00:00Z'));
  const data = CardDataSchema.parse({ dueDate: '2026-02-30' });
  const view = render(<BillCard data={data} />);
  expect(view.queryByText(/cards\.bill\.(due|overdue)/)).toBeNull();
  view.unmount();
  jest.useRealTimers();
});

it('still displays a valid date and its overdue status', () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-03-10T12:00:00Z'));
  const view = render(<BillCard data={{ dueDate: '2026-03-02' }} />);
  expect(view.getByText(/cards\.bill\.overdue/)).toBeTruthy();
  view.unmount();
});
