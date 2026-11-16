import { messageSwipeActions } from '@/utils/messageSwipeActions';
import type { SwipeAction } from '@/contexts/inbox-prefs-context';

const t = (key: string) => key;

it.each(['archive', 'delete', 'mark-read', 'snooze'] as const)(
  'preserves the %s command on either side and its full-swipe target',
  (key) => {
    const onAction = jest.fn();
    const row = messageSwipeActions(key, key, false, t, onAction);
    expect(row.fullSwipeAction).toEqual({ left: key, right: key });
    row.swipeActions.left[0].onPress?.();
    row.swipeActions.right[0].onPress?.();
    expect(onAction.mock.calls).toEqual([[key], [key]]);
  },
);

it('offers move-to-inbox for archive, preserves delete semantics and disables none', () => {
  const commands: SwipeAction[] = [];
  const row = messageSwipeActions('archive', 'delete', true, t, (key) => commands.push(key));
  expect(row.swipeActions.left[0].label).toBe('message.actions.moveToInbox');
  expect(row.swipeActions.right[0].tone).toBe('negative');
  const disabled = messageSwipeActions('none', 'none', false, t, (key) => commands.push(key));
  expect(disabled.swipeActions).toEqual({ left: [], right: [] });
  expect(disabled.fullSwipeAction).toEqual({ left: undefined, right: undefined });
  expect(commands).toEqual([]);
});
