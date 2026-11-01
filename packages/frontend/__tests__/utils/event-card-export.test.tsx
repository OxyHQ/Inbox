import { render } from '@testing-library/react';
import type { ReactNode } from 'react';

jest.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'en-US' }),
}));
jest.mock('@/constants/theme', () => ({
  useColors: () => ({ text: '', secondaryText: '' }),
}));
jest.mock('react-native', () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  StyleSheet: { create: (styles: unknown) => styles },
  Platform: { OS: 'web' },
  Linking: { openURL: jest.fn() },
}));
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);
jest.mock('@oxy.so/bloom/toast', () => ({ toast: { error: jest.fn() } }));
jest.mock('@oxy.so/bloom/icons/RiCalendarLine', () => ({ RiCalendarLine: () => null }));
jest.mock('@oxy.so/bloom/button', () => ({
  Button: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
}));
jest.mock('@oxy.so/bloom/card', () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardBody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock('@oxy.so/bloom/typography', () => ({
  Text: ({
    children,
    accessibilityLiveRegion,
  }: {
    children: ReactNode;
    accessibilityLiveRegion?: string;
  }) => <span aria-live={accessibilityLiveRegion}>{children}</span>,
}));

import { EventCard } from '@/components/cards/EventCard';
import { formatCardDate } from '@/utils/cardFormat';

it('shows the date and an explanation when a valid interval cannot be exported', () => {
  const view = render(<EventCard data={{ title: 'Holiday', startTime: '9999-12-31' }} />);
  const date = formatCardDate(
    'en-US',
    '9999-12-31',
    { weekday: 'short', month: 'short', day: 'numeric' },
    true,
  );
  expect(view.getByText(date as string)).toBeTruthy();
  expect(view.getByText('cards.event.exportUnavailable').getAttribute('aria-live')).toBe('polite');
  expect(view.queryByText('cards.event.addToCalendar')).toBeNull();
  expect(view.queryByText('cards.event.googleCalendar')).toBeNull();
});

it('keeps export actions for a representable event', () => {
  const view = render(
    <EventCard
      data={{ title: 'Holiday', startTime: '2026-10-15', endTime: '2026-10-15T12:00:00' }}
    />,
  );
  expect(view.getByText('cards.event.addToCalendar')).toBeTruthy();
  expect(view.getByText('cards.event.googleCalendar')).toBeTruthy();
  expect(view.queryByText('cards.event.exportUnavailable')).toBeNull();
});

it('retains the visible start if the next civil day is skipped', () => {
  if (Intl.DateTimeFormat().resolvedOptions().timeZone !== 'Pacific/Apia') return;
  const view = render(<EventCard data={{ title: 'Holiday', startTime: '2011-12-29' }} />);
  const date = formatCardDate(
    'en-US',
    '2011-12-29',
    { weekday: 'short', month: 'short', day: 'numeric' },
    true,
  );
  expect(view.getByText(date as string)).toBeTruthy();
  expect(view.getByText('cards.event.exportUnavailable')).toBeTruthy();
  expect(view.queryByText('cards.event.addToCalendar')).toBeNull();
});
