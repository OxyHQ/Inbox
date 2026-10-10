/**
 * One new message, one notification.
 *
 * New mail reaches a running app twice: as the realtime `email:new` event (the
 * in-app toast, `useInboxSocket`) and as a push (the OS banner, shown in the
 * foreground by `useForegroundNotificationHandler`). Both fired, so every
 * message announced itself twice. Both carry the same stored row id, so the
 * first to arrive CLAIMS it here and the second stays quiet — whichever wins
 * the race, the user is told once.
 *
 * Both also apply the same rule for "the user is already looking at it": the
 * folder the mail landed in is the list on screen. That used to read the
 * store's `viewMode` alone, which keeps the last folder while the user is in
 * Search, Subscriptions or Settings — so mail to that folder announced nothing
 * at all there. The route and the settings modal are tracked here too.
 */

/** Long enough to outlast push delivery lag; short enough to stay small. */
const CLAIM_TTL_MS = 10 * 60 * 1000;

const claimed = new Map<string, number>();

/**
 * Claim the announcement of message `id`.
 *
 * @returns `true` for the first claim — the caller may announce it — and
 *   `false` when the other channel already did.
 */
export function claimNewMailAnnouncement(id: string, now = Date.now()): boolean {
  for (const [key, at] of claimed) {
    if (now - at > CLAIM_TTL_MS) claimed.delete(key);
  }
  if (claimed.has(id)) return false;
  claimed.set(id, now);
  return true;
}

let currentPath: string | null = null;
let settingsOpen = false;

/** Record the route on screen (`usePathname()`). */
export function noteCurrentPath(pathname: string | null): void {
  currentPath = pathname;
}

/** Record whether the settings modal covers the screen. */
export function noteSettingsOpen(open: boolean): void {
  settingsOpen = open;
}

/** Routes that show something other than a mail list. */
const NON_LIST_ROUTE = /^\/(search|settings|subscriptions|compose)(\/|$)/i;

/** The subset of the store's `viewMode` this rule reads. */
type ViewModeLike = { type: string; mailbox?: { _id: string } } | null | undefined;

/**
 * Whether the user is looking at the list of `mailboxId` right now, so a new
 * row appearing in it is notification enough.
 */
export function isLookingAtMailbox(
  viewMode: ViewModeLike,
  mailboxId: string | null | undefined,
): boolean {
  if (!mailboxId || settingsOpen) return false;
  if (currentPath !== null && NON_LIST_ROUTE.test(currentPath)) return false;
  return viewMode?.type === 'mailbox' && viewMode.mailbox?._id === mailboxId;
}

/** Test-only reset. */
export function __resetNewMailAttention(): void {
  claimed.clear();
  currentPath = null;
  settingsOpen = false;
}
