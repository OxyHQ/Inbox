import { useTranslation } from '@/lib/i18n';
import {
  RiArchiveLine,
  RiDeleteBinLine,
  RiMailOpenLine,
  RiStarLine,
} from '@oxy.so/bloom/icons';
import { MailSelectionBar } from '@oxy.so/bloom/mail-list';
interface SelectionToolbarProps {
  count: number;
  onClose: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onStar: () => void;
  onMarkRead: () => void;
}
export function SelectionToolbar({
  count,
  onClose,
  onArchive,
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
          label: t('selection.archive'),
          icon: RiArchiveLine,
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
