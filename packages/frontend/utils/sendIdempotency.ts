/**
 * One idempotency key per compose SESSION, never per Send press.
 *
 * The API derives the outgoing `Message-Id` from this key and dedupes on it, so
 * reusing it is what makes a second press, a client timeout followed by a retry,
 * or a react-query mutation retry deliver the message once. The key used to be
 * minted inside every send call, which is how one reply left twice with two
 * different `Message-Id`s.
 */
export function newSendIdempotencyKey(): string {
  const random =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `inbox-send-${random}`;
}

/**
 * Where the message the key already sent is, as the API reports it. `failed`
 * will not be retried on its own; `cancelled` was called off by the user;
 * `unknown` is a legacy send with no delivery record — and what an API too old
 * to say anything reports.
 */
export const SENT_DELIVERY_STATES = [
  'scheduled',
  'sending',
  'retrying',
  'sent',
  'failed',
  'cancelled',
  'unknown',
] as const;
export type SentDeliveryState = (typeof SENT_DELIVERY_STATES)[number];

/** The message the API already filed under a compose session's key. */
export interface AlreadySent {
  /** Row id of it in Sent (or of the scheduled send); null for some legacy sends. */
  id: string | null;
  /** Its RFC `Message-ID`, when the API named it. */
  messageId: string | null;
  deliveryState: SentDeliveryState;
  /** When it is due to leave; only for `scheduled`. ISO time. */
  scheduledAt: string | null;
}

/**
 * The API refused a send because this session's key already sent a DIFFERENT
 * message: `422` with `details.reason: 'idempotency_key_reused'`. A compose
 * restored after a crash meets it: the restored body renders differently (a
 * new build, a new signature), so it is not byte-for-byte the message the key
 * filed. It is never "send again with a new key" on its own: if the message
 * is the one already sent, that delivers it twice.
 *
 * Read defensively, like every SDK error: the status and the body may be on the
 * error itself or on its `response`. Null for any other error.
 */
export function alreadySentUnderKey(error: unknown): AlreadySent | null {
  if (!error || typeof error !== 'object') return null;
  const candidate = error as {
    status?: unknown;
    statusCode?: unknown;
    details?: unknown;
    response?: { status?: unknown; data?: unknown };
  };
  const statuses = [candidate.status, candidate.statusCode, candidate.response?.status];
  if (!statuses.includes(422)) return null;
  const data = candidate.response?.data;
  const details =
    candidate.details ??
    (data && typeof data === 'object' ? (data as { details?: unknown }).details : undefined);
  if (!details || typeof details !== 'object') return null;
  const { reason, id, messageId, deliveryState, scheduledAt } = details as Record<string, unknown>;
  if (reason !== 'idempotency_key_reused') return null;
  const state = SENT_DELIVERY_STATES.find((known) => known === deliveryState) ?? 'unknown';
  return {
    id: typeof id === 'string' && id ? id : null,
    messageId: typeof messageId === 'string' && messageId ? messageId : null,
    deliveryState: state,
    scheduledAt:
      state === 'scheduled' && typeof scheduledAt === 'string' && scheduledAt ? scheduledAt : null,
  };
}
