import { Card, CardHeader, CardTitle, CardDescription } from '@oxy.so/bloom/card';
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
    <Card
      appearance="outline"
      accessibilityLabel={t('inbox.unreadable.title')}
      onPress={id && onOpen ? () => onOpen(id) : undefined}
    >
      <CardHeader>
        <CardTitle>{t('inbox.unreadable.title')}</CardTitle>
        <CardDescription>
          {[message.from, message.subject].filter(Boolean).join(' · ')}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
