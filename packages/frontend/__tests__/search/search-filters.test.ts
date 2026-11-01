import {
  dateRangeFilters,
  filtersDateRange,
  hasSearchCriteria,
  isInvalidSearchDate,
  pickSearchFilters,
  searchDateBound,
} from '@/utils/searchFilters';
import { defined } from '../fixtures/defined';
import { hasInvalidSearchDate, parseSearchQuery } from '@/utils/threadGrouping';

it('validates calendar days without changing timestamp or unknown formats', () => {
  expect(isInvalidSearchDate('2026-02-30')).toBe(true);
  expect(isInvalidSearchDate('2024-02-29')).toBe(false);
  expect(isInvalidSearchDate('1900-02-29')).toBe(true);
  expect(searchDateBound('2026-02-30')).toBe('2026-02-30');
  expect(searchDateBound('2026-10-15T10:00:00.000Z')).toBe('2026-10-15T10:00:00.000Z');
  expect(searchDateBound('legacy')).toBe('legacy');
  expect(hasInvalidSearchDate('after:2026-02-30 after:2026-02-28')).toBe(true);
  expect(hasInvalidSearchDate('after:garbage')).toBe(false);
  expect(parseSearchQuery('after:garbage').text).toBe('after:garbage');
  const early = new Date(0);
  early.setHours(0, 0, 0, 0);
  early.setFullYear(99, 1, 28);
  expect(searchDateBound('0099-02-28')).toBe(early.toISOString());
  if (Intl.DateTimeFormat().resolvedOptions().timeZone === 'Pacific/Apia') {
    expect(isInvalidSearchDate('2011-12-30')).toBe(true);
  }
});

it('searches read mail even when false is the only active filter', () => {
  expect(hasSearchCriteria({ unread: false })).toBe(true);
  expect(hasSearchCriteria({ hasAttachment: false, starred: false })).toBe(false);
  expect(pickSearchFilters({ q: 'invoice', unread: false, label: 'Receipts' })).toEqual({
    unread: false,
    label: 'Receipts',
  });
});

it('includes the full local end day and round-trips through the calendar', () => {
  const start = new Date(2026, 9, 24, 14);
  const end = new Date(2026, 9, 26, 9);
  const filters = dateRangeFilters({ start, end });
  expect(new Date(defined(filters.dateAfter))).toEqual(new Date(2026, 9, 24, 0, 0, 0, 0));
  expect(new Date(defined(filters.dateBefore))).toEqual(new Date(2026, 9, 26, 23, 59, 59, 999));
  expect(filtersDateRange(filters)).toEqual({
    start: new Date(defined(filters.dateAfter)),
    end: new Date(defined(filters.dateBefore)),
  });
  expect(start.getHours()).toBe(14);
  expect(end.getHours()).toBe(9);
});

it('reads date-only operators as local days and rejects incomplete or invalid ranges', () => {
  expect(filtersDateRange({ dateAfter: '2026-10-01', dateBefore: '2026-10-07' })).toEqual({
    start: new Date(2026, 9, 1),
    end: new Date(2026, 9, 7),
  });
  expect(filtersDateRange({ dateAfter: '2026-10-01' })).toBeNull();
  expect(filtersDateRange({ dateAfter: 'invalid', dateBefore: '2026-10-07' })).toBeNull();
  expect(dateRangeFilters(null)).toEqual({
    dateAfter: undefined,
    dateBefore: undefined,
  });
});
