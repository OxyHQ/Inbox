/**
 * Reading a sent message's delivery.
 *
 * A send is filed in Sent the moment the API accepts it and delivered in the
 * background, so "it is in Sent" no longer means "it left". `delivery` on the
 * message says whether it did; these are the questions the UI asks of it.
 */

import type { Message, MessageDelivery, RecipientInput } from '@/schemas/emailSchemas';

/** Still on its way or stopped — anything a user should be told about. */
export function isOutstanding(delivery: MessageDelivery | undefined): delivery is MessageDelivery {
  return delivery !== undefined && delivery.state !== 'sent';
}

/** It will not go out on its own; the user must act. */
export function isUndelivered(delivery: MessageDelivery | undefined): delivery is MessageDelivery {
  return delivery?.state === 'failed';
}

/**
 * The i18n key explaining why, by the contract's code. Null when there is no
 * code — nothing went wrong yet, or a newer server named a reason this client
 * does not know; the relay's own words are still shown.
 */
export function deliveryReasonKey(delivery: MessageDelivery): string | null {
  return delivery.errorCode ? `delivery.reason.${delivery.errorCode}` : null;
}

/**
 * Whether Retry can help. A bounce cannot: the recipient's server already
 * refused it, and the API refuses to send to a suppressed address again — the
 * way forward is to edit the message.
 */
export function canRetry(delivery: MessageDelivery): boolean {
  return delivery.state === 'failed' && delivery.errorCode !== 'bounced';
}

/** The Bloom accent a delivery is painted with: a failure is loud, waiting is not. */
export function deliveryTone(delivery: MessageDelivery): 'error' | 'warning' | 'default' {
  if (delivery.state === 'failed') return 'error';
  if (delivery.state === 'retrying') return 'warning';
  return 'default';
}

/**
 * A failed message as a new draft: every recipient (Bcc too), the body as it
 * was written, its attachments by file id, and its threading — so Edit as new
 * loses nothing the user would have to notice was missing.
 */
export function draftFromMessage(message: Message): {
  to: RecipientInput[];
  cc: RecipientInput[];
  bcc: RecipientInput[];
  subject: string;
  text?: string;
  html?: string;
  inReplyTo?: string;
  references?: string[];
  attachments?: { fileId: string; contentId?: string; isInline?: boolean }[];
} {
  const recipients = (list: Message['to']) =>
    list.map(({ name, address }) => (name ? { name, address } : { address }));
  return {
    to: recipients(message.to),
    cc: recipients(message.cc),
    bcc: recipients(message.bcc),
    subject: message.subject,
    ...(message.text ? { text: message.text } : {}),
    ...(message.html ? { html: message.html } : {}),
    ...(message.inReplyTo ? { inReplyTo: message.inReplyTo } : {}),
    ...(message.references.length > 0 ? { references: message.references } : {}),
    ...(message.attachments.length > 0
      ? {
          attachments: message.attachments.map((attachment) => ({
            fileId: attachment.fileId,
            ...(attachment.contentId ? { contentId: attachment.contentId } : {}),
            isInline: attachment.isInline,
          })),
        }
      : {}),
  };
}

/** Of a page of Sent messages, the ones still outstanding, stuck first. */
export function outstandingDeliveries(messages: Message[]): {
  failed: Message[];
  pending: Message[];
} {
  const failed: Message[] = [];
  const pending: Message[] = [];
  for (const message of messages) {
    if (isUndelivered(message.delivery)) failed.push(message);
    else if (isOutstanding(message.delivery)) pending.push(message);
  }
  return { failed, pending };
}
