/**
 * The messages this client has just changed itself.
 *
 * The API tells every connected client about a change, the one that made it
 * included (`email:changed`), and the realtime hook used to reconcile every
 * view on each of those echoes: archiving a conversation of 20 messages
 * re-read the lists, the counts, search and the open thread on top of the
 * optimistic update that had already shown it. A change named here is one the
 * mutation has already applied, so its echo is skipped.
 *
 * Noted when the request goes out — by the API client, so a replayed offline
 * mutation and an Undo count too — and forgotten after a while: an event for
 * the same message after that is someone else's change.
 */

const OWN_CHANGE_TTL_MS = 15_000;

const recent = new Map<string, number>();

export function noteOwnChange(messageIds: Iterable<string>, now = Date.now()): void {
  for (const id of messageIds) recent.set(id, now + OWN_CHANGE_TTL_MS);
}

export function isOwnChange(messageId: string, now = Date.now()): boolean {
  const until = recent.get(messageId);
  if (until === undefined) return false;
  if (until > now) return true;
  recent.delete(messageId);
  return false;
}

/** Tests only. */
export function __resetOwnChanges(): void {
  recent.clear();
}
