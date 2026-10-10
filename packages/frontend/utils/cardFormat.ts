/**
 * Formatting for the cards extracted from mail by AI. The extractor's output
 * is stored as it came back, so nothing here may assume it is well formed.
 */

/**
 * An amount in its currency. `Intl.NumberFormat` THROWS for a currency that is
 * not an ISO 4217 code — and the extractor returns "$" or "€" — which took the
 * whole inbox row down with it.
 */
export function formatMoney(amount: number, currency: string | null | undefined): string {
  const code = (currency || 'USD').trim();
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format(amount);
  } catch {
    const number = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
    return code ? `${code} ${number}`.trim() : number;
  }
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A card date, or null when it is not one. A date-only value (`2026-10-15`) is
 * that day HERE: `new Date('2026-10-15')` is midnight UTC, which west of
 * Greenwich is the evening before — a bill showed as due a day early and
 * turned "Overdue" the afternoon before it was.
 */
export function parseCardDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const dateOnly = DATE_ONLY.exec(value.trim());
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isDateOnly(value: string | null | undefined): boolean {
  return !!value && DATE_ONLY.test(value.trim());
}

/** A card date as text, or null when it cannot be read. */
export function formatCardDate(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
  withTime = false,
): string | null {
  const date = parseCardDate(value);
  if (!date) return null;
  return withTime && !isDateOnly(value) ? date.toLocaleString(undefined, options) : date.toLocaleDateString(undefined, options);
}

/** Whether a due date has passed. A date-only due date is due all of that day. */
export function isPastDue(value: string | null | undefined, now = new Date()): boolean {
  const date = parseCardDate(value);
  if (!date) return false;
  if (!isDateOnly(value)) return date < now;
  const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return endOfDay <= now;
}
