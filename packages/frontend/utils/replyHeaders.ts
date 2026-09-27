/**
 * RFC 5322 threading headers for a reply.
 *
 * `inReplyTo` is the parent's `Message-Id` HEADER, never its database row id.
 * The keyboard reply once sent `message._id`: the API wrote `In-Reply-To:
 * <row-uuid>`, the recipient could not thread it, the parent was never marked
 * answered, and the reply formed a detached thread of its own.
 *
 * Every id is checked against the contract's `rfcMessageIdSchema` — the same
 * rule oxy-api enforces with a 400 — before it is sent. A sender that wrote
 * its Message-Id without angle brackets is repaired; anything that still is
 * not a msg-id is left out, so a malformed header upstream costs threading,
 * never the reply itself.
 */

import { rfcMessageIdSchema } from '@oxy.so/contracts';
import type { Message } from '@/schemas/emailSchemas';

export interface ReplyHeaders {
  inReplyTo?: string;
  references: string[];
}

/** `id@host` → `<id@host>`; a valid msg-id unchanged; anything else `null`. */
export function toRfcMessageId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const bracketed = trimmed.startsWith('<') ? trimmed : `<${trimmed}>`;
  const result = rfcMessageIdSchema.safeParse(bracketed);
  return result.success ? result.data : null;
}

export function buildReplyHeaders(parent: Pick<Message, 'messageId' | 'references'>): ReplyHeaders {
  const inReplyTo = toRfcMessageId(parent.messageId);
  const chain = [...(parent.references ?? []), parent.messageId]
    .map(toRfcMessageId)
    .filter((id): id is string => id !== null);
  return {
    ...(inReplyTo ? { inReplyTo } : {}),
    references: [...new Set(chain)],
  };
}
