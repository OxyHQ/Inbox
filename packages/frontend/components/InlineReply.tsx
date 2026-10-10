import { MailAddressFields } from '@/components/MailAddressFields';
import { Card } from '@oxy.so/bloom/card';
import { MailComposeSurface } from '@oxy.so/bloom/mail-compose';
import { MailQuoteToggle } from '@oxy.so/bloom/mail-thread';
/**
 * Gmail-like inline reply component.
 *
 * Appears at the bottom of MessageDetail for quick replies without navigating
 * to a separate compose page. It is a full compose session (`useComposeSession`):
 * what is written is kept as a draft, closing it keeps that draft, and the
 * draft is gone once the reply is sent.
 */

import { useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { Text } from '@oxy.so/bloom/typography';
import { useOxy } from '@oxy.so/services';

import { RichTextEditor } from '@/components/RichTextEditor';
import { SmartReplyChips } from '@/components/SmartReplyChips';
import { TemplatePicker } from '@/components/TemplatePicker';
import { useComposeSession } from '@/hooks/useComposeSession';
import { useTranslation } from '@/lib/i18n';
import type { EmailTemplate, Message } from '@/services/emailApi';
import {
  editorContentToText,
  forwardedBody,
  quotedReply,
} from '@/utils/composeBody';
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
    // Seeded once for this reply; the recipients do not follow later edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Closing keeps what was written as a draft; there is no dialog in a thread.
  const handleClose = useCallback(() => {
    void session.saveAndClose();
  }, [session]);

  const handleSmartReplySelect = useCallback(
    (text: string) => session.insertText(text),
    [session],
  );

  const handleTemplateSelect = useCallback(
    (template: EmailTemplate) => session.insertText(template.body),
    [session],
  );

  return (
    <Card radius="panel" clipContent>
      <MailComposeSurface
        variant="sheet"
        title={mode === 'forward' ? t('compose.titleForward') : t('compose.titleReply')}
        onClose={handleClose}
        onSend={() => void session.send()}
        sending={session.sending}
        sendDisabled={session.sendDisabled}
        onDiscard={() => void session.discardDraft()}
        header={
          <MailAddressFields
            to={session.to}
            onToChange={session.setTo}
            cc={session.cc}
            onCcChange={session.setCc}
            bcc={session.bcc}
            onBccChange={session.setBcc}
          />
        }
        footer={<TemplatePicker onSelect={handleTemplateSelect} />}
        strings={{
          send: t('inlineReply.send'),
          close: t('common.close'),
          discard: t('compose.actions.discardDraft'),
        }}
      >
        {mode !== 'forward' && (
          <SmartReplyChips message={message} onSelectReply={handleSmartReplySelect} />
        )}
        <RichTextEditor
          value={session.body}
          onChange={session.updateBody}
          placeholder={t('inlineReply.placeholder')}
          autoFocus
        />
        {session.draftStatusLabel && (
          <Text accessibilityLiveRegion="polite">{session.draftStatusLabel}</Text>
        )}
        <MailQuoteToggle>
          <Text selectable>{editorContentToText(trailer, isWeb)}</Text>
        </MailQuoteToggle>
      </MailComposeSurface>
    </Card>
  );
}
