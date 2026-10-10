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
    references: trimReferences([...new Set(chain)]),
  };
}

/** The most ids `References` may carry (`sendMessageSchema` in the API). */
const MAX_REFERENCES = 100;

/**
 * A long thread's chain, cut to what the API accepts. The thread's first
 * message and the most recent ones are what threading relies on (RFC 5322
 * §3.6.4), so the middle goes. Uncut, every reply in a thread past a hundred
 * messages was refused with a 400.
 */
function trimReferences(ids: string[]): string[] {
  if (ids.length <= MAX_REFERENCES) return ids;
  return [ids[0], ...ids.slice(ids.length - (MAX_REFERENCES - 1))];
}

/**
 * The threading headers a saved reply draft already carries. They were written
 * from its parent when the draft was saved, so sending it later needs no
 * parent lookup; anything that is not a msg-id is left out, as above.
 */
export function draftReplyHeaders(draft: Pick<Message, 'inReplyTo' | 'references'>): ReplyHeaders | undefined {
  const inReplyTo = toRfcMessageId(draft.inReplyTo);
  const references = (draft.references ?? [])
    .map(toRfcMessageId)
    .filter((id): id is string => id !== null);
  if (!inReplyTo && references.length === 0) return undefined;
  return { ...(inReplyTo ? { inReplyTo } : {}), references: trimReferences([...new Set(references)]) };
}
