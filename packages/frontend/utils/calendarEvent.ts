/**
 * An event card as a calendar entry: an RFC 5545 `.ics` file and a Google
 * Calendar link. Built only from a start that parses — an event without one
 * cannot be put in a calendar, and `toISOString()` on an invalid date threw.
 */

import type { CardData } from '@/schemas/emailSchemas';
import { isDateOnly, parseCardDate } from './cardFormat';

export interface CalendarTimes {
  start: Date;
  end: Date;
  /** A date-only start is an all-day event, not midnight UTC. */
  allDay: boolean;
}

export function calendarTimes(data: Pick<CardData, 'startTime' | 'endTime'>): CalendarTimes | null {
  const start = parseCardDate(data.startTime);
  if (!start) return null;
  const allDay = isDateOnly(data.startTime);
  const parsedEnd = parseCardDate(data.endTime);
  const end =
    parsedEnd && parsedEnd > start
      ? allDay && isDateOnly(data.endTime)
        ? new Date(parsedEnd.getFullYear(), parsedEnd.getMonth(), parsedEnd.getDate() + 1)
        : parsedEnd
      : allDay
        ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)
        : new Date(start.getTime() + 60 * 60 * 1000);
  return { start, end, allDay };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `20260415T090000Z`, or `20260415` for an all-day value. */
function icsValue(date: Date, allDay: boolean): string {
  if (allDay) return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * RFC 5545 TEXT escaping (§3.3.11): `\\`, `\;`, `\,` and `\n`. Applied ONCE, to
 * text with real line breaks. The `;` used to be written as the JS literal
 * '\;' — which is just ';' — so a semicolon in a title went out unescaped.
 */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

const MAX_LINE_OCTETS = 75;

function utf8Length(codePoint: number): number {
  return codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4;
}

/**
 * Lines longer than 75 OCTETS are folded, as RFC 5545 §3.1 requires: by UTF-8
 * bytes, never inside a character. It used to cut every 74 UTF-16 units —
 * up to 222 bytes of CJK on one line, and an emoji cut in half, its two
 * surrogates encoded as two U+FFFD.
 */
function fold(line: string): string {
  const out: string[] = [];
  let current = '';
  let octets = 0;
  for (const char of line) {
    const size = utf8Length(char.codePointAt(0)!);
    if (octets + size > MAX_LINE_OCTETS) {
      out.push(current);
      // A continuation line starts with one space, which counts.
      current = ' ';
      octets = 1;
    }
    current += char;
    octets += size;
  }
  out.push(current);
  return out.join('\r\n');
}

/** A stable UID, so importing the same event twice updates it rather than duplicating it. */
function eventUid(data: CardData, times: CalendarTimes): string {
  const source = `${data.title ?? ''}|${times.start.toISOString()}|${data.location ?? ''}`;
  let hash = 0;
  for (let i = 0; i < source.length; i++) hash = (Math.imul(31, hash) + source.charCodeAt(i)) | 0;
  return `${(hash >>> 0).toString(36)}-${icsValue(times.start, false)}@inbox.oxy.so`;
}

/** The words an export writes into the event, in the app's language. */
export interface CalendarLabels {
  /** A line naming the organizer in the notes, e.g. `Organizer: Ann`. */
  organizer: (name: string) => string;
  /** The title of an event that has none. */
  untitled: string;
}

const ENGLISH_LABELS: CalendarLabels = {
  organizer: (name) => `Organizer: ${name}`,
  untitled: 'Event',
};

export function generateIcs(
  data: CardData,
  times: CalendarTimes,
  now = new Date(),
  labels: CalendarLabels = ENGLISH_LABELS,
): string {
  const dateParam = times.allDay ? ';VALUE=DATE' : '';
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Oxy Inbox//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    // UID and DTSTAMP are REQUIRED in a VEVENT; calendars rejected the file without them.
    `UID:${eventUid(data, times)}`,
    `DTSTAMP:${icsValue(now, false)}`,
    `DTSTART${dateParam}:${icsValue(times.start, times.allDay)}`,
    `DTEND${dateParam}:${icsValue(times.end, times.allDay)}`,
  ];
  lines.push(`SUMMARY:${escapeText(data.title || labels.untitled)}`);
  if (data.location) lines.push(`LOCATION:${escapeText(data.location)}`);
  const description = [data.description, data.organizer && labels.organizer(data.organizer)]
    .filter(Boolean)
    .join('\n');
  // Joined with a real line break, then escaped — it used to be joined with a
  // literal `\n` and escaped again, and calendars showed "\n" in the notes.
  if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.map(fold).join('\r\n');
}

export function googleCalendarUrl(
  data: CardData,
  times: CalendarTimes,
  labels: CalendarLabels = ENGLISH_LABELS,
): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: data.title || labels.untitled,
    dates: `${icsValue(times.start, times.allDay)}/${icsValue(times.end, times.allDay)}`,
  });
  if (data.location) params.set('location', data.location);
  if (data.description) params.set('details', data.description);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
