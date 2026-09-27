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
    globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `inbox-send-${random}`;
}
