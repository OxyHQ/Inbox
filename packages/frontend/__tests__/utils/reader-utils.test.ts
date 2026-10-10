/**
 * Formatting and planning helpers behind the reader: extracted cards, calendar
 * export, snooze/schedule presets and bundle reordering.
 */

jest.mock('@/hooks/useEmail', () => ({ useEmailStore: jest.fn() }));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
jest.mock('@oxy.so/bloom', () => ({ toast: { error: jest.fn() } }));

import { planBundleSwap } from '@/hooks/mutations/useBundleMutations';
import type { Bundle } from '@/services/emailApi';
import { calendarTimes, generateIcs } from '@/utils/calendarEvent';
import { formatMoney, isPastDue, parseCardDate } from '@/utils/cardFormat';
import { presetsThatMakeSense } from '@/utils/timePresets';
import { parseByteSize } from '@/utils/byteSize';
import { searchDateBound } from '@/utils/searchFilters';

describe('cards', () => {
  it('formats an amount whose "currency" is a symbol instead of throwing', () => {
    expect(() => formatMoney('en-US', 12.5, '$')).not.toThrow();
    expect(formatMoney('en-US', 12.5, '$')).toContain('12.50');
  });

  it('reads a date-only value as that local day', () => {
    const date = parseCardDate('2026-10-15')!;
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 9, 15, 0]);
    expect(parseCardDate('next tuesday')).toBeNull();
  });

  it('is due all of its due day', () => {
    expect(isPastDue('2026-10-15', new Date(2026, 9, 15, 23, 0))).toBe(false);
    expect(isPastDue('2026-10-15', new Date(2026, 9, 16, 0, 1))).toBe(true);
  });
});

describe('calendar export', () => {
  const event = { title: 'Launch', startTime: '2026-10-15T09:00:00Z', description: 'Line one', organizer: 'Ann' };

  it('carries the UID and DTSTAMP every VEVENT needs, and real line breaks in its notes', () => {
    const ics = generateIcs(event as never, calendarTimes(event)!, new Date('2026-10-01T00:00:00Z'));
    expect(ics).toMatch(/\r\nUID:[^\r\n]+@inbox\.oxy\.so\r\n/);
    expect(ics).toContain('DTSTAMP:20261001T000000Z');
    expect(ics).toContain('DESCRIPTION:Line one\\nOrganizer: Ann');
    expect(ics).not.toContain('\\\\n');
  });

  it('makes a date-only start an all-day event, and refuses an event with no readable start', () => {
    const ics = generateIcs({ title: 'Holiday' } as never, calendarTimes({ startTime: '2026-12-25' })!);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261225');
    expect(ics).toContain('DTEND;VALUE=DATE:20261226');
    expect(calendarTimes({ startTime: 'soon' })).toBeNull();
  });
});

describe('time presets', () => {
  const at = (date: Date) => () => date;

  it('drops "later today" when it lands tomorrow, and duplicates of the same moment', () => {
    const now = new Date(2026, 9, 11, 22, 0); // a Sunday, 10 PM
    const monday9 = new Date(2026, 9, 12, 9, 0);
    const result = presetsThatMakeSense(
      [
        { label: 'x.laterToday', getDate: at(new Date(now.getTime() + 3 * 3600_000)) },
        { label: 'x.tomorrow', getDate: at(monday9) },
        { label: 'x.thisWeekend', getDate: at(new Date(2026, 9, 17, 9, 0)) },
        { label: 'x.nextWeek', getDate: at(monday9) },
      ],
      now,
    );
    expect(result.map((o) => o.label)).toEqual(['x.tomorrow']);
  });
});

describe('bundle reordering', () => {
  const bundles = [
    { _id: 'a', order: 0 },
    { _id: 'b', order: 1 },
    { _id: 'c', order: 2 },
  ] as Bundle[];

  it('swaps with the neighbour, planned from the order before any optimistic update', () => {
    expect(planBundleSwap(bundles, 'b', 'up')).toEqual([
      { id: 'b', order: 0 },
      { id: 'a', order: 1 },
    ]);
    expect(planBundleSwap(bundles, 'a', 'down')).toEqual([
      { id: 'a', order: 1 },
      { id: 'b', order: 0 },
    ]);
    expect(planBundleSwap(bundles, 'a', 'up')).toBeNull();
  });
});

describe('search date bounds', () => {
  it('sends a bare date as the start of that LOCAL day', () => {
    expect(searchDateBound('2026-10-15')).toBe(new Date(2026, 9, 15).toISOString());
    expect(searchDateBound('2026-10-15T10:00:00.000Z')).toBe('2026-10-15T10:00:00.000Z');
  });
});

describe('byte sizes', () => {
  it('reads units and refuses what is not a size', () => {
    expect(parseByteSize('5 MB')).toBe(5 * 1024 * 1024);
    expect(parseByteSize('2048')).toBe(2048);
    expect(parseByteSize('big')).toBeNull();
  });
});
