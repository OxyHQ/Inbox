import type { SearchOptions } from '@/hooks/queries/useSearchMessages';
import type { DateRange } from '@oxy.so/bloom/date-picker';

export type SearchFilters = Omit<SearchOptions, 'q'>;

/** Keep the API filter fields when a parsed query becomes editable chips. */
export function pickSearchFilters(options: SearchOptions): SearchFilters {
  const { q: _query, ...filters } = options;
  return filters;
}

export function hasSearchCriteria(options: SearchOptions): boolean {
  return Object.entries(options).some(([key, value]) =>
    key === 'unread' ? typeof value === 'boolean' : Boolean(value),
  );
}

/** The mail API uses inclusive >= / <= timestamps; include the entire last day. */
export function dateRangeFilters(
  range: DateRange | null,
): Pick<SearchFilters, 'dateAfter' | 'dateBefore'> {
  if (!range) return { dateAfter: undefined, dateBefore: undefined };
  const start = new Date(range.start);
  const end = new Date(range.end);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { dateAfter: start.toISOString(), dateBefore: end.toISOString() };
}

export function filtersDateRange(filters: SearchFilters): DateRange | null {
  if (!filters.dateAfter || !filters.dateBefore) return null;
  // Date-only search operators represent local calendar days, not UTC midnights.
  const parse = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T00:00:00`)
      : new Date(value);
  const start = parse(filters.dateAfter);
  const end = parse(filters.dateBefore);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()))
    return null;
  return { start, end };
}

/**
 * An `after:` / `before:` value as the instant the API compares with. A bare
 * `YYYY-MM-DD` is a LOCAL day, as the filter chips treat it: sent as-is, the
 * API read it as UTC midnight and the search started or stopped hours away
 * from the day the user meant. `after:` starts at the beginning of that day;
 * `before:` is exclusive, like Gmail's, so it ends where that day begins.
 */
export function searchDateBound(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!dateOnly) return value;
  return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])).toISOString();
}
