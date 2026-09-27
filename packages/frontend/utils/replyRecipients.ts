/**
 * Who a reply goes to. One definition for the composer route and the inline
 * reply, because two drifted copies are how a reply-all ended up sending the
 * user a copy of their own mail.
 */

import type { EmailAddress, Message } from '@/schemas/emailSchemas';

export type ReplyMode = 'reply' | 'reply-all';

/** What the client knows about the signed-in user's own addresses. */
export interface OwnIdentity {
  username?: string | null;
  email?: string | null;
}

const OXY_MAIL_DOMAIN = 'oxy.so';

function normalise(address: string): string {
  return address.trim().toLowerCase();
}

/**
 * True for the user's primary address, their account email, and any
 * plus-address of the primary (`nate+receipts@oxy.so`), which the API delivers
 * to the same mailbox.
 */
export function isOwnAddress(address: string, identity: OwnIdentity): boolean {
  const candidate = normalise(address);
  if (identity.email && candidate === normalise(identity.email)) return true;
  const username = identity.username?.trim().toLowerCase();
  if (!username) return false;
  const at = candidate.lastIndexOf('@');
  if (at < 0 || candidate.slice(at + 1) !== OXY_MAIL_DOMAIN) return false;
  const local = candidate.slice(0, at);
  return local === username || local.startsWith(`${username}+`);
}

function uniqueAddresses(list: EmailAddress[], exclude: Set<string>): EmailAddress[] {
  const out: EmailAddress[] = [];
  for (const entry of list) {
    const key = normalise(entry.address);
    if (!key || exclude.has(key)) continue;
    exclude.add(key);
    out.push(entry);
  }
  return out;
}

/**
 * Gmail's rules:
 * - reply goes to `Reply-To` when the sender set one, else to `From`;
 * - reply-all adds every other To and Cc recipient;
 * - the user's own addresses are never a recipient;
 * - replying to a message the user SENT goes to that message's recipients,
 *   not back to themselves.
 */
export function buildReplyRecipients(
  parent: Pick<Message, 'from' | 'to' | 'cc' | 'replyTo'>,
  mode: ReplyMode,
  identity: OwnIdentity,
): { to: EmailAddress[]; cc: EmailAddress[] } {
  const own = (a: EmailAddress) => isOwnAddress(a.address, identity);
  const parentTo = parent.to ?? [];
  const parentCc = parent.cc ?? [];

  if (own(parent.from)) {
    const seen = new Set<string>();
    const to = uniqueAddresses(parentTo.filter((a) => !own(a)), seen);
    const cc = mode === 'reply-all' ? uniqueAddresses(parentCc.filter((a) => !own(a)), seen) : [];
    return { to, cc };
  }

  const primary = parent.replyTo?.address ? parent.replyTo : parent.from;
  const seen = new Set<string>();
  const to = uniqueAddresses([primary], seen);
  if (mode === 'reply') return { to, cc: [] };

  const others = uniqueAddresses(parentTo.filter((a) => !own(a)), seen);
  const cc = uniqueAddresses(parentCc.filter((a) => !own(a)), seen);
  return { to: [...to, ...others], cc };
}

/** Comma-joined addresses, the form the composer's recipient fields hold. */
export function joinAddresses(list: EmailAddress[]): string {
  return list.map((a) => a.address).join(', ');
}
