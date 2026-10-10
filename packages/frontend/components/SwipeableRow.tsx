import type { SwipeAction } from '@/contexts/inbox-prefs-context';
import { useTranslation } from '@/lib/i18n';
import {
  RiArchiveLine,
  RiDeleteBinLine,
  RiInbox2Line,
  RiMailOpenLine,
  RiTimeLine,
} from '@oxy.so/bloom/icons';
import { SwipeRow, useSwipeAvailable, type SwipeRowAction } from '@oxy.so/bloom/swipe-row';
import { useState, type ReactNode } from 'react';
interface SwipeableRowProps {
  children: ReactNode;
  messageId: string;
  leftAction: SwipeAction;
  rightAction: SwipeAction;
  onAction: (action: SwipeAction, messageId: string) => void;
  /** In Archive: the archive swipe moves the row back to the Inbox. */
  archived?: boolean;
}
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
/** Bloom owns touch detection and gestures on both web and native. */
export function SwipeableRow({
  children,
  messageId,
  leftAction,
  rightAction,
  onAction,
  archived = false,
}: SwipeableRowProps) {
  const enabled = useSwipeAvailable();
  const [gesture, setGesture] = useState(0);
  const { t } = useTranslation();
  const action = (key: SwipeAction): SwipeRowAction[] =>
    key === 'none'
      ? []
      : [
          {
            key,
            icon: key === 'archive' && archived ? RiInbox2Line : icons[key],
            label: t(key === 'archive' && archived ? 'message.actions.moveToInbox' : labels[key]),
            tone: key === 'delete' ? 'negative' : 'accent',
            onPress: () => onAction(key, messageId),
          },
        ];
  if (!enabled || (leftAction === 'none' && rightAction === 'none')) return <>{children}</>;
  return (
    <SwipeRow
      key={gesture}
      onOpenChange={(side) => {
        if (side === null) return;
        const selected = side === 'left' ? leftAction : rightAction;
        if (selected === 'none') return;
        // A completed swipe executes the configured mail action. A fresh gesture
        // surface closes even when the action (read/snooze) keeps the message visible.
        setGesture((value) => value + 1);
        onAction(selected, messageId);
      }}
      actions={{ left: action(leftAction), right: action(rightAction) }}
      closeLabel={t('common.close')}
    >
      {children}
    </SwipeRow>
  );
}
