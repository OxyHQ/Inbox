/**
 * Search result rows. Results the client could not read are listed first, as
 * degraded rows, so a message the server matched never silently disappears
 * from the results.
 */

import type { Message, UnreadableMessage } from '@/services/emailApi';

export type SearchItem =
  | { kind: 'message'; message: Message; key: string }
  | { kind: 'unreadable'; row: UnreadableMessage; key: string };

/** Unreadable rows across pages, each once (a row id can recur on a later page). */
export function collectUnreadable(
  pages: { unreadable?: UnreadableMessage[] }[],
): UnreadableMessage[] {
  const seen = new Set<string>();
  const rows: UnreadableMessage[] = [];
  for (const page of pages) {
    for (const row of page.unreadable ?? []) {
      if (row._id) {
        if (seen.has(row._id)) continue;
        seen.add(row._id);
      }
      rows.push(row);
    }
  }
  return rows;
}

export function buildSearchItems(
  results: Message[],
  unreadable: UnreadableMessage[],
): SearchItem[] {
  return [
    ...unreadable.map(
      (row, index): SearchItem => ({
        kind: 'unreadable',
        row,
        key: `unreadable-${row._id ?? index}`,
      }),
    ),
    ...results.map((message): SearchItem => ({ kind: 'message', message, key: message._id })),
  ];
}
