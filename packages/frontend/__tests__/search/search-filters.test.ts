import {
  dateRangeFilters,
  filtersDateRange,
  hasSearchCriteria,
  pickSearchFilters,
} from '@/utils/searchFilters';

it('searches read mail even when false is the only active filter', () => {
  expect(hasSearchCriteria({ unread: false })).toBe(true);
  expect(hasSearchCriteria({ hasAttachment: false, starred: false })).toBe(
    false,
  );
  expect(
    pickSearchFilters({ q: 'invoice', unread: false, label: 'Receipts' }),
  ).toEqual({ unread: false, label: 'Receipts' });
});

it('includes the full local end day and round-trips through the calendar', () => {
  const start = new Date(2026, 9, 24, 14);
  const end = new Date(2026, 9, 26, 9);
  const filters = dateRangeFilters({ start, end });
  expect(new Date(filters.dateAfter!)).toEqual(
    new Date(2026, 9, 24, 0, 0, 0, 0),
  );
  expect(new Date(filters.dateBefore!)).toEqual(
    new Date(2026, 9, 26, 23, 59, 59, 999),
  );
  expect(filtersDateRange(filters)).toEqual({
    start: new Date(filters.dateAfter!),
    end: new Date(filters.dateBefore!),
  });
  expect(start.getHours()).toBe(14);
  expect(end.getHours()).toBe(9);
});

it('reads date-only operators as local days and rejects incomplete or invalid ranges', () => {
  expect(
    filtersDateRange({ dateAfter: '2026-10-01', dateBefore: '2026-10-07' }),
  ).toEqual({ start: new Date(2026, 9, 1), end: new Date(2026, 9, 7) });
  expect(filtersDateRange({ dateAfter: '2026-10-01' })).toBeNull();
  expect(
    filtersDateRange({ dateAfter: 'invalid', dateBefore: '2026-10-07' }),
  ).toBeNull();
  expect(dateRangeFilters(null)).toEqual({
    dateAfter: undefined,
    dateBefore: undefined,
  });
});
