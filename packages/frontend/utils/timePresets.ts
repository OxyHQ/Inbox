/**
 * The quick time choices of the snooze and schedule-send sheets, minus the
 * ones that would mislead.
 *
 * - "Later today" is now + 3 h after 3 PM, which after 9 PM is TOMORROW — it
 *   was offered as "Later today · 1:00 AM".
 * - "This weekend" picked on a Saturday jumped a whole week; it is only
 *   offered on a weekday.
 * - Two choices that land on the same moment (on a Sunday, "Tomorrow morning"
 *   and "Monday morning") are one choice.
 */
export function presetsThatMakeSense<T extends { label: string; getDate: () => Date }>(
  options: T[],
  now: Date,
): T[] {
  const seen = new Set<number>();
  return options.filter((option) => {
    const date = option.getDate();
    if (date.getTime() <= now.getTime()) return false;
    if (option.label.endsWith('.laterToday') && date.toDateString() !== now.toDateString())
      return false;
    if (option.label.endsWith('.thisWeekend') && (now.getDay() === 0 || now.getDay() === 6))
      return false;
    if (seen.has(date.getTime())) return false;
    seen.add(date.getTime());
    return true;
  });
}
