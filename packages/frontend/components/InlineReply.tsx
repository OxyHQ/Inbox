import { MailAddressFields } from '@/components/MailAddressFields';
import { stripHtml } from '@/utils/stripHtml';
import { MailComposeSurface } from '@oxy.so/bloom/mail-compose';
import { MailQuoteToggle } from '@oxy.so/bloom/mail-thread';
/**
 * Gmail-like inline reply component.
 *
 * Appears at the bottom of MessageDetail for quick replies
 * without navigating to a separate compose page.
 */

import { toast } from '@oxy.so/bloom';
import { useOxy } from '@oxy.so/services';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Text } from 'react-native';

import {
  RichTextEditor,
  type RichTextEditorHandle,
} from '@/components/RichTextEditor';
import { SmartReplyChips } from '@/components/SmartReplyChips';
import { TemplatePicker } from '@/components/TemplatePicker';
import { useSendMessageWithUndo } from '@/hooks/mutations/useMessageMutations';
import { useEmailStore } from '@/hooks/useEmail';
import { useTranslation } from '@/lib/i18n';
import type {
  EmailTemplate,
  Message,
  RecipientInput,
} from '@/services/emailApi';
import { buildReplyHeaders } from '@/utils/replyHeaders';
import { buildReplyRecipients, joinAddresses } from '@/utils/replyRecipients';
import { newSendIdempotencyKey } from '@/utils/sendIdempotency';

const isWeb = Platform.OS === 'web';

function formatQuoteDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatQuotedText(message: Message, header: string): string {
  const originalText = message.text || '';
  const quoted = originalText
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
  return `\n\n${header}\n${quoted}`;
}

interface InlineReplyProps {
  message: Message;
  mode: 'reply' | 'reply-all' | 'forward';
  onClose: () => void;
  onSent?: () => void;
}

export function InlineReply({
  message,
  mode,
  onClose,
  onSent,
}: InlineReplyProps) {
  const { t } = useTranslation();
  const { user } = useOxy();
  const api = useEmailStore((s) => s._api);
  const { sendWithUndo, isPending: sendPending } = useSendMessageWithUndo();
  const bodyRef = useRef<RichTextEditorHandle>(null);

  // One key for this reply, however many times Send is pressed or retried.
  const [idempotencyKey] = useState(newSendIdempotencyKey);

  const initialRecipients = useMemo(
    () =>
      mode === 'forward'
        ? { to: [], cc: [] }
        : buildReplyRecipients(message, mode, {
            username: user?.username,
            email: user?.email,
          }),
    [mode, message, user?.username, user?.email],
  );
  const initialTo = joinAddresses(initialRecipients.to);
  const initialCc = joinAddresses(initialRecipients.cc);

  const initialSubject = useMemo(() => {
    if (mode === 'forward') {
      return message.subject.startsWith('Fwd:')
        ? message.subject
        : `Fwd: ${message.subject}`;
    }
    return message.subject.startsWith('Re:')
      ? message.subject
      : `Re: ${message.subject}`;
  }, [mode, message]);

  const [to, setTo] = useState(initialTo);
  const [cc, setCc] = useState(initialCc);
  const [bcc, setBcc] = useState('');
  const [body, setBody] = useState('');
  const [quotedText, setQuotedText] = useState('');
  const [signatureLoaded, setSignatureLoaded] = useState(false);

  // Load signature and quoted text on mount
  useEffect(() => {
    if (!api || signatureLoaded) return;

    const setup = async () => {
      let signature = '';
      try {
        const settings = await api.getSettings();
        if (settings.signature) {
          signature = `\n\n--\n${settings.signature}`;
        }
      } catch {
        // Signature is optional
      }

      if (mode === 'forward') {
        const forwardBody =
          t('inlineReply.forwardHeader', {
            from: message.from.name || message.from.address,
            date: formatQuoteDate(message.date),
            subject: message.subject,
            to: message.to.map((a) => a.name || a.address).join(', '),
          }) + (message.text || '');
        setQuotedText(forwardBody);
      } else {
        setQuotedText(
          formatQuotedText(
            message,
            t('inlineReply.quotedPrefix', {
              date: formatQuoteDate(message.date),
              author: message.from.name || message.from.address,
            }),
          ),
        );
      }

      setBody(signature);
      setSignatureLoaded(true);
    };

    setup();
  }, [api, signatureLoaded, message, mode, t]);

  const sending = sendPending;

  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const parseAddresses = useCallback((input: string): RecipientInput[] => {
    return input
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((addr) => isValidEmail(addr))
      .map((addr) => ({ address: addr }));
  }, []);

  const handleSend = useCallback(() => {
    if (!to.trim()) {
      toast.error(t('compose.toast.addRecipient'));
      return;
    }

    const toAddresses = parseAddresses(to);
    if (toAddresses.length === 0) {
      toast.error(t('compose.toast.invalidEmail'));
      return;
    }

    const fullBody = body + quotedText;

    sendWithUndo(
      {
        to: toAddresses,
        cc: cc.trim() ? parseAddresses(cc) : undefined,
        bcc: bcc.trim() ? parseAddresses(bcc) : undefined,
        subject: initialSubject,
        text: isWeb ? stripHtml(fullBody) : fullBody,
        html: isWeb ? fullBody : undefined,
        ...(mode !== 'forward' ? buildReplyHeaders(message) : {}),
        idempotencyKey,
      },
      {
        onSuccess: () => {
          onSent?.();
          onClose();
        },
        // Accepted but not delivered: close the composer (the server holds it)
        // without claiming it was sent.
        onQueued: () => {
          onSent?.();
          onClose();
        },
      },
    );
  }, [
    to,
    cc,
    bcc,
    body,
    quotedText,
    initialSubject,
    message,
    mode,
    sendWithUndo,
    onClose,
    onSent,
    parseAddresses,
    t,
    idempotencyKey,
  ]);

  // Handle smart reply selection - insert the text into the body
  const handleSmartReplySelect = useCallback((text: string) => {
    setBody((prev) => {
      // If there's already content, add a newline before the smart reply
      if (prev.trim()) {
        return `${text}\n\n${prev}`;
      }
      return text + prev;
    });
    // On web, also update the contentEditable editor
    if (isWeb && bodyRef.current) {
      // Get current body, prepend the smart reply
      bodyRef.current.setContent(text);
    }
    bodyRef.current?.focus();
  }, []);

  // Only show smart replies for reply/reply-all, not forward
  const showSmartReplies = mode !== 'forward';

  // Handle template selection — insert into reply fields
  const handleTemplateSelect = useCallback(
    (template: EmailTemplate) => {
      if (!body.trim()) {
        if (isWeb && bodyRef.current) {
          bodyRef.current.setContent(template.body);
        } else {
          setBody(template.body);
        }
      } else {
        const newBody = body + '\n' + template.body;
        if (isWeb && bodyRef.current) {
          bodyRef.current.setContent(newBody);
        } else {
          setBody(newBody);
        }
      }
      bodyRef.current?.focus();
    },
    [body],
  );

  return (
    <MailComposeSurface
      variant="sheet"
      title={
        mode === 'forward' ? t('compose.titleForward') : t('compose.titleReply')
      }
      onClose={onClose}
      onSend={handleSend}
      sending={sending}
      onDiscard={onClose}
      header={
        <MailAddressFields
          to={to}
          onToChange={setTo}
          cc={cc}
          onCcChange={setCc}
          bcc={bcc}
          onBccChange={setBcc}
        />
      }
      footer={<TemplatePicker onSelect={handleTemplateSelect} />}
      strings={{
        send: t('inlineReply.send'),
        close: t('common.close'),
        discard: t('compose.actions.discard'),
      }}
    >
      {showSmartReplies && (
        <SmartReplyChips
          message={message}
          onSelectReply={handleSmartReplySelect}
        />
      )}
      <RichTextEditor
        ref={bodyRef}
        value={body}
        onChange={setBody}
        placeholder={t('inlineReply.placeholder')}
        autoFocus
      />
      <MailQuoteToggle>
        <Text selectable>{quotedText}</Text>
      </MailQuoteToggle>
    </MailComposeSurface>
  );
}
