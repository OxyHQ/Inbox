import { View } from 'react-native';
import { EmptyState } from '@oxy.so/bloom/empty-state';
import { RiErrorWarningLine } from '@oxy.so/bloom/icons';
import { useTranslation } from '@/lib/i18n';
import type { UnreadableMessage } from '@/services/emailApi';

interface UnreadableThreadEntryProps {
  row: UnreadableMessage;
  onRetry: () => void;
  onOpenRaw?: (messageId: string) => void;
}

/** Keep its place in the conversation and preserve both recovery actions. */
export function UnreadableThreadEntry({
  row,
  onRetry,
  onOpenRaw,
}: UnreadableThreadEntryProps) {
  const { t } = useTranslation();
  const id = row._id;
  return (
    <View accessibilityRole="alert">
      <EmptyState
        variant="compact"
        icon={RiErrorWarningLine}
        title={t('inbox.unreadable.title')}
        description={[row.from, row.subject].filter(Boolean).join(' · ')}
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
