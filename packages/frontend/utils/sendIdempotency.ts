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

/** The message the API already filed under a compose session's key. */
export interface AlreadySent {
  /** Row id of it in Sent (or of the scheduled send); null for some legacy sends. */
  id: string | null;
  /** Its RFC `Message-ID`, when the API named it. */
  messageId: string | null;
}

/**
 * The API refused a send because this session's key already sent a DIFFERENT
 * message: `422` with `details.reason: 'idempotency_key_reused'`. That is how a
 * compose restored after a crash learns it was sent before the crash — the
 * restored body renders differently (a new build, a new signature), so it is
 * not byte-for-byte the message the key filed. It means "already sent", never
 * "send again with a new key": that would deliver the message twice.
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
  const { reason, id, messageId } = details as Record<string, unknown>;
  if (reason !== 'idempotency_key_reused') return null;
  return {
    id: typeof id === 'string' && id ? id : null,
    messageId: typeof messageId === 'string' && messageId ? messageId : null,
  };
}
