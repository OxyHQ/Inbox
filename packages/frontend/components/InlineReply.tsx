/**
 * Gmail-like inline reply component.
 *
 * Appears at the bottom of MessageDetail for quick replies without navigating
 * to a separate compose page. It is a full compose session (`useComposeSession`)
 * rendered by the same `MailComposer` as the full composer, so a reply can do
 * everything a new message can: what is written is kept as a draft, closing
 * keeps that draft, and the draft is gone once the reply is sent.
 */

import { Card } from '@oxy.so/bloom/card';
import { useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { useOxy } from '@oxy.so/services';

import { MailComposer } from '@/components/MailComposer';
import { SmartReplyChips } from '@/components/SmartReplyChips';
import { useComposeSession } from '@/hooks/useComposeSession';
import { useTranslation } from '@/lib/i18n';
import type { Message } from '@/services/emailApi';
import { forwardedBody, quotedReply } from '@/utils/composeBody';
import { formatQuoteDate } from '@/utils/quoteDate';
import { buildReplyHeaders } from '@/utils/replyHeaders';
import { buildReplyRecipients, joinAddresses } from '@/utils/replyRecipients';

const isWeb = Platform.OS === 'web';

interface InlineReplyProps {
  message: Message;
  mode: 'reply' | 'reply-all' | 'forward';
  onClose: () => void;
}

export function InlineReply({ message, mode, onClose }: InlineReplyProps) {
  const { t } = useTranslation();
  const { user } = useOxy();

  // biome-ignore lint/correctness/useExhaustiveDependencies: Seeded once for this reply; the recipients do not follow later edits.
  const initial = useMemo(() => {
    const recipients =
      mode === 'forward'
        ? { to: [], cc: [] }
        : buildReplyRecipients(message, mode, {
            username: user?.username,
            email: user?.email,
          });
    const prefix = mode === 'forward' ? 'Fwd:' : 'Re:';
    return {
      to: joinAddresses(recipients.to),
      cc: joinAddresses(recipients.cc),
      subject: message.subject.startsWith(prefix)
        ? message.subject
        : `${prefix} ${message.subject}`,
    };
  }, []);

  const trailer = useMemo(
    () =>
      mode === 'forward'
        ? forwardedBody(
            message,
            t('inlineReply.forwardHeader', {
              from: message.from.name || message.from.address,
              date: formatQuoteDate(message.date),
              subject: message.subject,
              to: message.to.map((a) => a.name || a.address).join(', '),
            }),
            isWeb,
          )
        : quotedReply(
            message,
            t('inlineReply.quotedPrefix', {
              date: formatQuoteDate(message.date),
              author: message.from.name || message.from.address,
            }),
            isWeb,
          ),
    [message, mode, t],
  );

  const replyHeaders = useMemo(
    () => (mode === 'forward' ? undefined : buildReplyHeaders(message)),
    [message, mode],
  );

  const session = useComposeSession({
    recoveryIdentity: `${mode}:${message._id}`,
    initial,
    replyTo: mode === 'forward' ? undefined : message._id,
    replyHeaders,
    awaitingReplyHeaders: false,
    trailer,
    insertSignature: true,
    onFinished: onClose,
  });

  const handleSmartReplySelect = useCallback((text: string) => session.insertText(text), [session]);

  return (
    <Card radius="panel" clipContent>
      <MailComposer
        session={session}
        layout="inline"
        title={mode === 'forward' ? t('compose.titleForward') : t('compose.titleReply')}
        trailer={trailer}
        lead={
          mode !== 'forward' && (
            <SmartReplyChips message={message} onSelectReply={handleSmartReplySelect} />
          )
        }
        placeholder={t('inlineReply.placeholder')}
        autoFocus
      />
    </Card>
  );
}
