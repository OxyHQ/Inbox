import { View } from 'react-native';
import { EmptyState } from '@oxy.so/bloom/empty-state';
import { EmptyStateSticker } from './EmptyStateSticker';
import { useTranslation } from '@/lib/i18n';
import type { UnreadableMessage } from '@/services/emailApi';

interface UnreadableThreadEntryProps {
  row: UnreadableMessage;
  onRetry: () => void;
  onOpenRaw?: (messageId: string) => void;
}

/** Keep its place in the conversation and preserve both recovery actions. */
export function UnreadableThreadEntry({ row, onRetry, onOpenRaw }: UnreadableThreadEntryProps) {
  const { t } = useTranslation();
  const id = row._id;
  return (
    <View accessibilityRole="alert">
      <EmptyState
        variant="compact"
        illustration={<EmptyStateSticker name="loadError" size={64} />}
        title={t('inbox.unreadable.title')}
        description={[
          t('empty.unreadableDescription'),
          [row.from, row.subject].filter(Boolean).join(' · '),
        ]
          .filter(Boolean)
          .join('\n')}
        action={{ label: t('inbox.unreadable.retry'), onPress: onRetry }}
        secondaryAction={
          id && onOpenRaw
            ? {
                label: t('inbox.unreadable.openRaw'),
                onPress: () => onOpenRaw(id),
              }
            : undefined
        }
      />
    </View>
  );
}
