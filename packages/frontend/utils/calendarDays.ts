/**
 * Whole calendar days from `from` to `to`, in local time — 0 for the same day,
 * 1 for the next. Counted between the two DATES, not divided out of the
 * milliseconds between them: the day the clocks go forward is 23 hours long,
 * and dividing by 24 hours made yesterday "today" across it.
 */
export function calendarDaysBetween(from: Date, to: Date): number {
  const start = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const end = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((end - start) / 86_400_000);
}
