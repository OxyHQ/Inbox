import { ListItem } from '@oxy.so/bloom/list';
import { useTranslation } from '@/lib/i18n';
import type { UnreadableMessage } from '@/services/emailApi';

interface UnreadableMessageRowProps {
  message: UnreadableMessage;
  onOpen?: (messageId: string) => void;
}

/** Keep an unreadable message visible and addressable without inventing its content. */
export function UnreadableMessageRow({ message, onOpen }: UnreadableMessageRowProps) {
  const { t } = useTranslation();
  const id = message._id;
  return (
    <ListItem
      title={t('inbox.unreadable.title')}
      supporting={[message.from, message.subject].filter(Boolean).join(' · ')}
      onPress={id && onOpen ? () => onOpen(id) : undefined}
    />
  );
}
