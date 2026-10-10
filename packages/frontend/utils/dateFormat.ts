/**
 * `Intl.DateTimeFormat`s in the app's language, built once per locale and
 * options. Not the device's: with Spanish chosen in the app on an English
 * device, `toLocale*(undefined)` wrote "Sat, Oct 10". And not built per call:
 * a list formats one date per row, and an options object defeats the engine's
 * own formatter cache.
 */

import { calendarDaysBetween } from '@oxy.so/utils/date';

const cache = new Map<string, Intl.DateTimeFormat>();

export function dateFormatter(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = cache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    cache.set(key, formatter);
  }
  return formatter;
}

/**
 * Row timestamp, scaled to how far back the message is: the closer it is, the
 * more precise the label. Today only needs a time; last week only needs a
 * weekday; older than that needs the date.
 *
 *   today      → 3:33 PM
 *   yesterday  → Yesterday
 *   < 7 days   → Sat
 *   this year  → Jul 22
 *   older      → Jul 22, 24
 */
const TIME: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
const WEEKDAY: Intl.DateTimeFormatOptions = { weekday: 'short' };
const MONTH_DAY: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
const MONTH_DAY_YEAR: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: '2-digit',
};

export function formatRowTime(dateStr: string, yesterdayLabel: string, locale: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = calendarDaysBetween(date, now);

  if (diffDays === 0) return dateFormatter(locale, TIME).format(date);
  if (diffDays === 1) return yesterdayLabel;
  if (diffDays < 7) return dateFormatter(locale, WEEKDAY).format(date);

  if (date.getFullYear() === now.getFullYear()) {
    return dateFormatter(locale, MONTH_DAY).format(date);
  }
  return dateFormatter(locale, MONTH_DAY_YEAR).format(date);
}
