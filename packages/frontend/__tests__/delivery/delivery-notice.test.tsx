/**
 * The notice on a sent message that has not left: what happened, in the
 * user's language and the relay's own words, and what they can do about it.
 */

const mutate = jest.fn();
jest.mock('@/hooks/mutations/useRetryDelivery', () => ({
  useRetryDelivery: () => ({ mutate, isPending: false }),
}));
jest.mock('react-native', () => ({
  StyleSheet: { create: <T,>(styles: T) => styles },
  View: ({ children }: { children?: unknown }) =>
    require('react').createElement('div', null, children),
}));
const push = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push }) }));
jest.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars?.count === undefined ? key : `${key}:${vars.count}`,
  }),
}));
jest.mock('@/constants/theme', () => ({
  useColors: () => ({ error: 'red', warning: 'orange', secondaryText: 'grey' }),
}));
jest.mock('@oxy.so/bloom/typography', () => ({
  Text: ({ children }: { children?: unknown }) =>
    require('react').createElement('span', null, children),
}));
jest.mock('@oxy.so/bloom/admonition', () => {
  const pass = ({ children }: { children?: unknown }) => children;
  return {
    AdmonitionRoot: ({ children, type }: { children?: unknown; type?: string }) =>
      require('react').createElement('div', { role: 'alert', 'data-type': type }, children),
    AdmonitionRow: pass,
    AdmonitionIcon: () => null,
    AdmonitionContent: pass,
    AdmonitionText: ({ children }: { children?: unknown }) =>
      require('react').createElement('p', null, children),
    AdmonitionButton: ({ children, onPress }: { children?: unknown; onPress?: () => void }) =>
      require('react').createElement('button', { type: 'button', onClick: onPress }, children),
  };
});

import { fireEvent, render, screen } from '@testing-library/react';
import { DeliveryNotice } from '@/components/DeliveryStatus';
import { MessageSchema } from '@/schemas/emailSchemas';
import { wireDelivery, wireMessage } from '../fixtures/wire';

const message = (delivery?: Record<string, unknown>) =>
  MessageSchema.parse(
    wireMessage({
      _id: 'row-1',
      id: 'row-1',
      to: [{ name: '', address: 'support@example.com' }],
      subject: 'Re: Quota',
      text: 'Thanks',
      ...(delivery ? { delivery } : {}),
    }),
  );

beforeEach(() => {
  mutate.mockReset();
  push.mockReset();
});

describe('DeliveryNotice', () => {
  it('shows nothing for received mail, nor for a message that went out', () => {
    const { container, rerender } = render(<DeliveryNotice message={message()} />);
    expect(container.innerHTML).toBe('');
    rerender(
      <DeliveryNotice
        message={message(wireDelivery({ state: 'sent', error: null, errorCode: null }))}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('explains a refusal, quotes the relay, and offers Retry and Edit as new', () => {
    render(<DeliveryNotice message={message(wireDelivery())} />);
    expect(screen.getByRole('alert').getAttribute('data-type')).toBe('error');
    expect(screen.getByText('delivery.failed · delivery.reason.rejected')).toBeTruthy();
    expect(screen.getByText('554 5.7.1 Message rejected')).toBeTruthy();

    fireEvent.click(screen.getByText('delivery.retry'));
    expect(mutate).toHaveBeenCalledWith('row-1');

    fireEvent.click(screen.getByText('delivery.editAsNew'));
    expect(push).toHaveBeenCalledWith({
      pathname: '/compose',
      params: { to: 'support@example.com', subject: 'Re: Quota', body: 'Thanks' },
    });
  });

  it('offers no Retry for a bounce, which the server would refuse', () => {
    render(
      <DeliveryNotice
        message={message(wireDelivery({ errorCode: 'bounced', error: 'x@y.z: 550 unknown' }))}
      />,
    );
    expect(screen.queryByText('delivery.retry')).toBeNull();
    expect(screen.getByText('delivery.editAsNew')).toBeTruthy();
  });

  it('shows a retrying delivery as a warning, without actions', () => {
    render(
      <DeliveryNotice
        message={message(
          wireDelivery({ state: 'retrying', attempts: 2, errorCode: 'relay_unavailable' }),
        )}
      />,
    );
    expect(screen.getByRole('alert').getAttribute('data-type')).toBe('warning');
    expect(screen.queryByText('delivery.retry')).toBeNull();
    expect(screen.queryByText('delivery.editAsNew')).toBeNull();
  });
});
