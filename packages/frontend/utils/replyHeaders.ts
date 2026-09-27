/**
 * RFC 5322 threading headers for a reply.
 *
 * `inReplyTo` is the parent's `Message-Id` HEADER, never its database row id.
 * The keyboard reply once sent `message._id`: the API wrote `In-Reply-To:
 * <row-uuid>`, the recipient could not thread it, the parent was never marked
 * answered, and the reply formed a detached thread of its own.
 */

import type { Message } from '@/schemas/emailSchemas';

export interface ReplyHeaders {
  inReplyTo: string;
  references: string[];
}

export function buildReplyHeaders(parent: Pick<Message, 'messageId' | 'references'>): ReplyHeaders {
  const chain = [...(parent.references ?? []), parent.messageId].filter(Boolean);
  return {
    inReplyTo: parent.messageId,
    references: [...new Set(chain)],
  };
}
