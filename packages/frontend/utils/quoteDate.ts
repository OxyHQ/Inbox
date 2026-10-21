import { dateFormatter } from './dateFormat';

const QUOTE_DATE: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

/**
 * The date in a reply's attribution line and a forward's header, in the app's
 * language — the line around it is translated, and the device's language
 * wrote an English date into a Spanish one.
 */
export function formatQuoteDate(dateStr: string, locale: string): string {
  return dateFormatter(locale, QUOTE_DATE).format(new Date(dateStr));
}
