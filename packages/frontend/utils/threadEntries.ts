/**
 * The conversation view's rows, in reading order: the messages this client
 * parsed and the ones it could not, side by side. An unreadable message keeps
 * its place in the conversation instead of vanishing from it.
 */

import type { Message, UnreadableMessage } from '@/services/emailApi';

export type ThreadEntry =
  | { kind: 'message'; message: Message; key: string }
  | { kind: 'unreadable'; row: UnreadableMessage; key: string };

function timeOf(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * Oldest first. An unreadable row is placed by its `receivedAt`; one with no
 * readable date goes last, where it is still seen.
 */
export function buildThreadEntries(messages: Message[], unreadable: UnreadableMessage[]): ThreadEntry[] {
  const entries: { entry: ThreadEntry; time: number | null; order: number }[] = [];
  messages.forEach((message, order) => {
    entries.push({
      entry: { kind: 'message', message, key: message._id },
      time: timeOf(message.date),
      order,
    });
  });
  unreadable.forEach((row, index) => {
    entries.push({
      entry: { kind: 'unreadable', row, key: `unreadable-${row._id ?? index}` },
      time: timeOf(row.receivedAt),
      order: messages.length + index,
    });
  });
  entries.sort((a, b) => {
    if (a.time === null && b.time === null) return a.order - b.order;
    if (a.time === null) return 1;
    if (b.time === null) return -1;
    return a.time - b.time || a.order - b.order;
  });
  return entries.map(({ entry }) => entry);
}
