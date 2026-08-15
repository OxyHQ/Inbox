/**
 * Client-side search parsing and conversation grouping helpers.
 *
 * The API returns a stable server-derived `threadId`; the relationship fields
 * remain as a conservative fallback for older cached responses. Subject-only
 * grouping is deliberately not used: two unrelated conversations can have the
 * same subject, and a false merge is worse than showing two rows.
 */

import type { Message } from '@/services/emailApi';

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
export function formatSearchInterpretation(options: SearchInterpretationOptions): string {
  const parts: string[] = [];
  const text = options.q?.trim() || options.text?.trim();

  if (text) parts.push(`"${text}"`);
  if (options.from) parts.push(`from ${options.from}`);
  if (options.to) parts.push(`to ${options.to}`);
  if (options.subject) parts.push(`subject contains "${options.subject}"`);
  if (options.hasAttachment) parts.push('with attachments');
  if (options.mailbox) parts.push(`in ${options.mailbox}`);
  if (options.label) parts.push(`label ${options.label}`);
  if (options.starred) parts.push('starred');
  if (options.unread === true) parts.push('unread');
  if (options.unread === false) parts.push('read');
  if (options.after) parts.push(`after ${options.after}`);
  if (options.before) parts.push(`before ${options.before}`);

  return parts.join(', ') || 'all emails';
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

/**
 * Collapse a date-ordered message array into one representative row per thread,
 * preserving the original ordering by first appearance. The representative is
 * the most recent message in the thread, annotated with the total count.
 */
export function collapseThreads(messages: Message[]): Message[] {
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

  const groups = new Map<number, { rep: Message; count: number; hasUnread: boolean }>();
  const order: number[] = [];

  messages.forEach((message, index) => {
    const root = find(index);
    const entry = groups.get(root);
    if (!entry) {
      groups.set(root, { rep: message, count: 1, hasUnread: !message.flags.seen });
      order.push(root);
      return;
    }

    entry.count += 1;
    if (!message.flags.seen) entry.hasUnread = true;
    if (new Date(message.date).getTime() > new Date(entry.rep.date).getTime()) {
      entry.rep = message;
    }
  });

  return order.map((root) => {
    const entry = groups.get(root);
    if (!entry) return messages[root];
    const { rep, count, hasUnread } = entry;
    const threadCount = Math.max(count, rep.threadCount ?? 1);
    let result = threadCount === rep.threadCount ? rep : { ...rep, threadCount };
    if (hasUnread && result.flags.seen) {
      result = { ...result, flags: { ...result.flags, seen: false } };
    }
    return result;
  });
}
