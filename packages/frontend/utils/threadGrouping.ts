/**
 * Client-side search parsing and conversation grouping helpers.
 *
 * The API returns a stable server-derived `threadId`; the relationship fields
 * remain as a conservative fallback for older cached responses. Subject-only
 * grouping is deliberately not used: two unrelated conversations can have the
 * same subject, and a false merge is worse than showing two rows.
 */

import type { Message } from '@/services/emailApi';
import type { TranslateFn } from '@/lib/i18n';

export interface ParsedSearchQuery {
  text: string;
  mailbox?: string;
  starred?: boolean;
  unread?: boolean;
  from?: string;
  to?: string;
  subject?: string;
  hasAttachment?: boolean;
  label?: string;
  after?: string;
  before?: string;
}

interface SearchInterpretationOptions {
  text?: string;
  q?: string;
  mailbox?: string;
  starred?: boolean;
  unread?: boolean;
  from?: string;
  to?: string;
  subject?: string;
  hasAttachment?: boolean;
  label?: string;
  after?: string;
  before?: string;
}

function tokenizeSearchQuery(query: string): string[] {
  const tokens: string[] = [];
  let token = '';
  let quote: '"' | "'" | null = null;

  for (const character of query.trim()) {
    if (quote) {
      token += character;
      if (character === quote) quote = null;
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      token += character;
    } else if (/\s/.test(character)) {
      if (token) tokens.push(token);
      token = '';
    } else {
      token += character;
    }
  }

  if (token) tokens.push(token);
  return tokens;
}

function unquoteSearchValue(value: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Parse the supported Gmail-style operators without dropping unknown input. */
export function parseSearchQuery(query: string): ParsedSearchQuery {
  const result: ParsedSearchQuery = { text: '' };
  const textParts: string[] = [];

  for (const token of tokenizeSearchQuery(query)) {
    const operatorMatch = token.match(/^([a-z]+):(.*)$/i);
    if (!operatorMatch) {
      textParts.push(unquoteSearchValue(token));
      continue;
    }

    const operator = operatorMatch[1].toLowerCase();
    const value = unquoteSearchValue(operatorMatch[2]);
    let handled = true;

    switch (operator) {
      case 'in':
        if (value) {
          if (value.toLowerCase() === 'starred') result.starred = true;
          else result.mailbox = value.toLowerCase();
        } else {
          handled = false;
        }
        break;
      case 'is':
        switch (value.toLowerCase()) {
          case 'starred':
            result.starred = true;
            break;
          case 'unread':
            result.unread = true;
            break;
          case 'read':
            result.unread = false;
            break;
          default:
            handled = false;
        }
        break;
      case 'from':
        if (value) result.from = value;
        else handled = false;
        break;
      case 'to':
        if (value) result.to = value;
        else handled = false;
        break;
      case 'subject':
        if (value) result.subject = value;
        else handled = false;
        break;
      case 'has':
        if (value.toLowerCase() === 'attachment') result.hasAttachment = true;
        else handled = false;
        break;
      case 'label':
        if (value) result.label = value;
        else handled = false;
        break;
      case 'after':
        if (isIsoDate(value)) result.after = value;
        else handled = false;
        break;
      case 'before':
        if (isIsoDate(value)) result.before = value;
        else handled = false;
        break;
      default:
        handled = false;
    }

    if (!handled) textParts.push(unquoteSearchValue(token));
  }

  result.text = textParts.join(' ');
  return result;
}

/** Render structured filters consistently in the search interpretation row. */
export function formatSearchInterpretation(
  options: SearchInterpretationOptions,
  translate?: TranslateFn,
): string {
  const parts: string[] = [];
  const text = options.q?.trim() || options.text?.trim();
  const t: TranslateFn = translate ?? ((key, vars) => {
    const value = vars?.value ?? '';
    switch (key) {
      case 'search.nl.fromValue': return `from ${value}`;
      case 'search.nl.toValue': return `to ${value}`;
      case 'search.nl.subjectContains': return `subject contains "${value}"`;
      case 'search.nl.withAttachments': return 'with attachments';
      case 'search.nl.starred': return 'starred';
      case 'search.nl.unread': return 'unread';
      case 'search.nl.read': return 'read';
      case 'search.nl.allEmails': return 'all emails';
      default: return key;
    }
  });

  if (text) parts.push(`"${text}"`);
  if (options.from) parts.push(t('search.nl.fromValue', { value: options.from }));
  if (options.to) parts.push(t('search.nl.toValue', { value: options.to }));
  if (options.subject) parts.push(t('search.nl.subjectContains', { value: options.subject }));
  if (options.hasAttachment) parts.push(t('search.nl.withAttachments'));
  if (options.mailbox) parts.push(`in ${options.mailbox}`);
  if (options.label) parts.push(`label ${options.label}`);
  if (options.starred) parts.push(t('search.nl.starred'));
  if (options.unread === true) parts.push(t('search.nl.unread'));
  if (options.unread === false) parts.push(t('search.nl.read'));
  if (options.after) parts.push(`after ${options.after}`);
  if (options.before) parts.push(`before ${options.before}`);

  return parts.join(', ') || t('search.nl.allEmails');
}

function relationIdsOf(message: Message): string[] {
  return [
    message.threadId ? `thread:${message.threadId}` : undefined,
    message._id,
    message.messageId,
    message.inReplyTo ?? undefined,
    ...(message.references ?? []),
  ].filter((value): value is string => Boolean(value));
}

/** One conversation in a list: the row it is shown as, and every message in it. */
export interface ThreadGroup {
  /** The newest message, carrying the thread count and the thread's unread state. */
  row: Message;
  /** Every message of the thread in this list, the row's own included. */
  members: Message[];
}

/**
 * Group a date-ordered message array into conversations, preserving the order
 * of first appearance. The row is the most recent message, annotated with the
 * total count, and shown unread when any message in it is.
 *
 * The members are what an action on the row acts on. Acting on the row's id
 * alone archived one message of a thread (the row came straight back, showing
 * the next one), and a row shown unread because an OLDER message was unread
 * could never be marked read: its own message already was.
 */
export function groupThreads(messages: Message[]): ThreadGroup[] {
  const parent = messages.map((_, index) => index);

  function find(index: number): number {
    let root = index;
    while (parent[root] !== root) root = parent[root];
    while (parent[index] !== index) {
      const next = parent[index];
      parent[index] = root;
      index = next;
    }
    return root;
  }

  function union(first: number, second: number): void {
    const firstRoot = find(first);
    const secondRoot = find(second);
    if (firstRoot !== secondRoot) parent[secondRoot] = firstRoot;
  }

  const ownerByRelation = new Map<string, number>();
  messages.forEach((message, index) => {
    for (const relationId of relationIdsOf(message)) {
      const owner = ownerByRelation.get(relationId);
      if (owner === undefined) ownerByRelation.set(relationId, index);
      else union(index, owner);
    }
  });

  const groups = new Map<number, { rep: Message; members: Message[]; hasUnread: boolean; hasPinned: boolean }>();
  const order: number[] = [];

  messages.forEach((message, index) => {
    const root = find(index);
    const entry = groups.get(root);
    if (!entry) {
      groups.set(root, {
        rep: message,
        members: [message],
        hasUnread: !message.flags.seen,
        hasPinned: message.flags.pinned,
      });
      order.push(root);
      return;
    }

    entry.members.push(message);
    if (!message.flags.seen) entry.hasUnread = true;
    if (message.flags.pinned) entry.hasPinned = true;
    if (new Date(message.date).getTime() > new Date(entry.rep.date).getTime()) {
      entry.rep = message;
    }
  });

  return order.map((root) => {
    const entry = groups.get(root);
    if (!entry) return { row: messages[root], members: [messages[root]] };
    const { rep, members, hasUnread, hasPinned } = entry;
    const threadCount = Math.max(members.length, rep.threadCount ?? 1);
    let row = threadCount === rep.threadCount ? rep : { ...rep, threadCount };
    if (hasUnread && row.flags.seen) {
      row = { ...row, flags: { ...row.flags, seen: false } };
    }
    // A conversation holding a pinned message is pinned. Shown unpinned, it sat
    // at the pinned message's place, out of date order, and opened a second
    // section with the same date heading.
    if (hasPinned && !row.flags.pinned) {
      row = { ...row, flags: { ...row.flags, pinned: true } };
    }
    return { row, members };
  });
}

/** One row per conversation; see `groupThreads`. */
export function collapseThreads(messages: Message[]): Message[] {
  return groupThreads(messages).map((group) => group.row);
}
