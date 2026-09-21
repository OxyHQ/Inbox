/** Bulk mail actions share Bloom's header islands and accessible icon buttons. */
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageHeader } from '@oxy.so/bloom/page-header';
import { IconButton } from '@oxy.so/bloom/button';
import { RiCloseLine, RiArchiveLine, RiDeleteBinLine, RiStarLine, RiMailOpenLine } from '@oxy.so/bloom/icons';
import { useTranslation } from '@/lib/i18n';
interface SelectionToolbarProps { count: number; onClose: () => void; onArchive: () => void; onDelete: () => void; onStar: () => void; onMarkRead: () => void; }
export function SelectionToolbar({ count, onClose, onArchive, onDelete, onStar, onMarkRead }: SelectionToolbarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  return <View style={{ paddingTop: insets.top }}><PageHeader title={String(count)} leading={<IconButton accessibilityLabel={t('common.close')} icon={<RiCloseLine />} onPress={onClose} />} actions={<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
    <IconButton accessibilityLabel={t('selection.archive')} icon={<RiArchiveLine />} onPress={onArchive} />
    <IconButton accessibilityLabel={t('selection.delete')} icon={<RiDeleteBinLine />} onPress={onDelete} />
    <IconButton accessibilityLabel={t('selection.star')} icon={<RiStarLine />} onPress={onStar} />
    <IconButton accessibilityLabel={t('selection.markRead')} icon={<RiMailOpenLine />} onPress={onMarkRead} />
  </View>} /></View>;
}
