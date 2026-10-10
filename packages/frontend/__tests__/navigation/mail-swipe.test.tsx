import { SwipeableRow } from '@/components/SwipeableRow';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

let mockTouch = true;
jest.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@oxy.so/bloom/icons', () => new Proxy({}, { get: () => () => null }));
jest.mock('@oxy.so/bloom/swipe-row', () => ({
  useSwipeAvailable: () => mockTouch,
  SwipeRow: ({ onOpenChange, actions, children }: any) => {
    const [open, setOpen] = useState(false);
    return (
      <div>
        <span>{open ? 'actions open' : 'actions closed'}</span>
        {(['left', 'right'] as const)
          .filter((side) => actions[side].length)
          .map((side) => (
            <button
              key={side}
              onClick={() => {
                setOpen(true);
                onOpenChange(side);
              }}
            >
              Swipe {side}
            </button>
          ))}
        <button onClick={() => onOpenChange(null)}>Cancel swipe</button>
        {children}
      </div>
    );
  },
}));

it('executes the configured action on a completed swipe and closes even if the row remains', () => {
  const action = jest.fn();
  render(
    <SwipeableRow
      messageId="message-7"
      leftAction="mark-read"
      rightAction="snooze"
      onAction={action}
    >
      <span>Message</span>
    </SwipeableRow>,
  );
  fireEvent.click(screen.getByText('Swipe left'));
  expect(action).toHaveBeenLastCalledWith('mark-read', 'message-7');
  expect(screen.getByText('actions closed')).toBeTruthy();
  fireEvent.click(screen.getByText('Swipe right'));
  expect(action).toHaveBeenLastCalledWith('snooze', 'message-7');
  fireEvent.click(screen.getByText('Cancel swipe'));
  expect(action).toHaveBeenCalledTimes(2);
});
it('keeps disabled directions and non-touch layouts inert', () => {
  const action = jest.fn();
  const view = render(
    <SwipeableRow messageId="m" leftAction="none" rightAction="delete" onAction={action}>
      Message
    </SwipeableRow>,
  );
  expect(screen.queryByText('Swipe left')).toBeNull();
  fireEvent.click(screen.getByText('Swipe right'));
  expect(action).toHaveBeenCalledWith('delete', 'm');
  mockTouch = false;
  view.rerender(
    <SwipeableRow messageId="m" leftAction="archive" rightAction="delete" onAction={action}>
      Message
    </SwipeableRow>,
  );
  expect(screen.queryByText('Swipe right')).toBeNull();
  mockTouch = true;
});
