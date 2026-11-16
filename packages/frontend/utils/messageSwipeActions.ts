import type { SwipeAction } from '@/contexts/inbox-prefs-context';
import type { TranslateFn } from '@/lib/i18n';
import type { ListAction } from '@oxy.so/bloom/list';
import { RiArchiveLine } from '@oxy.so/bloom/icons/RiArchiveLine';
import { RiDeleteBinLine } from '@oxy.so/bloom/icons/RiDeleteBinLine';
import { RiInbox2Line } from '@oxy.so/bloom/icons/RiInbox2Line';
import { RiMailOpenLine } from '@oxy.so/bloom/icons/RiMailOpenLine';
import { RiTimeLine } from '@oxy.so/bloom/icons/RiTimeLine';

const icons = {
  archive: RiArchiveLine,
  delete: RiDeleteBinLine,
  'mark-read': RiMailOpenLine,
  snooze: RiTimeLine,
};
const labels = {
  archive: 'selection.archive',
  delete: 'selection.delete',
  'mark-read': 'selection.markRead',
  snooze: 'message.actions.snooze',
};
/** Map persisted mail commands to Bloom's shared list interaction. */
export function messageSwipeActions(
  left: SwipeAction,
  right: SwipeAction,
  archived: boolean,
  t: TranslateFn,
  onAction: (action: SwipeAction) => void,
) {
  const action = (key: SwipeAction): ListAction[] =>
    key === 'none'
      ? []
      : [
          {
            key,
            icon: key === 'archive' && archived ? RiInbox2Line : icons[key],
            label: t(key === 'archive' && archived ? 'message.actions.moveToInbox' : labels[key]),
            tone: key === 'delete' ? 'negative' : 'accent',
            onPress: () => onAction(key),
          },
        ];
  return {
    swipeActions: { left: action(left), right: action(right) },
    fullSwipeAction: {
      left: left === 'none' ? undefined : left,
      right: right === 'none' ? undefined : right,
    },
  };
}
