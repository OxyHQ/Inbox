import { useTranslation } from '@/lib/i18n';
import {
  RiArchiveLine,
  RiDeleteBinLine,
  RiInbox2Line,
  RiMailOpenLine,
  RiStarLine,
} from '@oxy.so/bloom/icons';
import { MailSelectionBar } from '@oxy.so/bloom/mail-list';
interface SelectionToolbarProps {
  count: number;
  onClose: () => void;
  onArchive: () => void;
  /** Everything selected is archived: the action moves it back to the Inbox. */
  archived?: boolean;
  onDelete: () => void;
  onStar: () => void;
  onMarkRead: () => void;
}
export function SelectionToolbar({
  count,
  onClose,
  onArchive,
  archived = false,
  onDelete,
  onStar,
  onMarkRead,
}: SelectionToolbarProps) {
  const { t } = useTranslation();
  return (
    <MailSelectionBar
      count={count}
      total={count}
      onClear={onClose}
      actions={[
        {
          key: 'archive',
          label: t(archived ? 'message.actions.moveToInbox' : 'selection.archive'),
          icon: archived ? RiInbox2Line : RiArchiveLine,
          onPress: onArchive,
        },
        {
          key: 'delete',
          label: t('selection.delete'),
          icon: RiDeleteBinLine,
          tone: 'negative',
          onPress: onDelete,
        },
        {
          key: 'star',
          label: t('selection.star'),
          icon: RiStarLine,
          onPress: onStar,
        },
        {
          key: 'read',
          label: t('selection.markRead'),
          icon: RiMailOpenLine,
          onPress: onMarkRead,
        },
      ]}
      strings={{
        clearSelection: t('common.close'),
        selectedCount: (count) => t('selection.count', { count }),
      }}
    />
  );
}
