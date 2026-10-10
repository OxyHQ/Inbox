/**
 * Settings and subscriptions rows say what is true, in the reader's language.
 */

jest.mock('@oxy.so/bloom/item', () => ({
  Item: ({ title, subtitle, trailing }: any) => (
    <div>
      <span>{title}</span>
      {subtitle}
      {trailing}
    </div>
  ),
}));
jest.mock('@oxy.so/bloom/button', () => ({
  Button: ({ children, disabled, onPress }: any) => (
    <button disabled={disabled} onClick={onPress}>
      {children}
    </button>
  ),
}));
jest.mock('@oxy.so/bloom/typography', () => ({
  Text: ({ children }: any) => <span>{children}</span>,
}));
jest.mock('@oxy.so/bloom/design-tokens', () => ({ SPACING: { 'space-2': 8 } }));
jest.mock('react-native', () => ({
  View: ({ children }: any) => <div>{children}</div>,
  StyleSheet: { create: (styles: unknown) => styles },
}));
jest.mock('@/constants/theme', () => ({ useColors: () => ({ text: 'x', secondaryText: 'y' }) }));
jest.mock('@/components/Avatar', () => ({ SenderAvatar: () => null }));
jest.mock('@oxy.so/bloom/loading', () => ({ Loading: () => null }));
jest.mock('@oxy.so/bloom/settings-modal', () => ({
  SettingsGeneralPage: () => null,
  SettingsValueField: () => null,
}));
jest.mock('@/hooks/queries/useQuota', () => ({ useQuota: () => ({ data: undefined }) }));
jest.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars && 'count' in vars ? `${key}#${String(vars.count)}` : key,
    locale: 'en-US',
  }),
}));

import { fireEvent, render, screen } from '@testing-library/react';

import { SubscriptionRow } from '@/components/SubscriptionRow';
import { formatQuotaPercent } from '@/components/settings/sections/StorageSection';
import type { Subscription } from '@/services/emailApi';

const subscription = (overrides: Partial<Subscription> = {}): Subscription => ({
  _id: 'news@example.com',
  name: 'News',
  messageCount: 1,
  readCount: 0,
  latestDate: '2026-10-01T00:00:00.000Z',
  oldestDate: '2026-10-01T00:00:00.000Z',
  latestMessageId: 'm1',
  hasListUnsubscribe: true,
  type: 'list-unsubscribe',
  ...overrides,
});

describe('SubscriptionRow', () => {
  it('counts messages through a plural key, not an English "email(s)"', () => {
    render(<SubscriptionRow subscription={subscription({ messageCount: 1 })} onUnsubscribe={jest.fn()} isUnsubscribing={false} />);
    expect(screen.getByText('subscriptions.messageCount#1')).toBeTruthy();
  });

  it('offers the way out while still subscribed', () => {
    const onUnsubscribe = jest.fn();
    render(<SubscriptionRow subscription={subscription()} onUnsubscribe={onUnsubscribe} isUnsubscribing={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'subscriptions.unsubscribe' }));
    expect(onUnsubscribe).toHaveBeenCalledWith('news@example.com', 'list-unsubscribe');
  });

  it('shows an unsubscribed sender as such, with nothing left to press', () => {
    const onUnsubscribe = jest.fn();
    render(
      <SubscriptionRow
        subscription={subscription({ unsubscribed: true, unsubscribedAt: '2026-10-10T00:00:00.000Z' })}
        onUnsubscribe={onUnsubscribe}
        isUnsubscribing={false}
      />,
    );
    const button = screen.getByRole('button', { name: 'subscriptions.unsubscribed' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'subscriptions.unsubscribe' })).toBeNull();
  });

  it('shows a blocked frequent sender as blocked', () => {
    render(
      <SubscriptionRow
        subscription={subscription({ type: 'frequent', unsubscribed: true })}
        onUnsubscribe={jest.fn()}
        isUnsubscribing={false}
      />,
    );
    expect(screen.getByRole('button', { name: 'subscriptions.blocked' })).toBeTruthy();
  });
});

describe('formatQuotaPercent', () => {
  it('rounds to one decimal in the app locale', () => {
    expect(formatQuotaPercent(42.857142857, 'en-US')).toBe('42.9%');
    expect(formatQuotaPercent(50, 'en-US')).toBe('50%');
    // Locale-shaped, not a hardcoded `${n}%`.
    expect(formatQuotaPercent(42.857142857, 'de-DE')).toMatch(/^42,9\s%$/);
  });
});
