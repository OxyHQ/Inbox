/**
 * Plural forms follow each language's own rules (CLDR), and a count with no
 * dedicated form never shows the raw key.
 */

let locale = 'en-US';
jest.mock('@/lib/i18n/locale-context', () => ({
  useLocale: () => ({ locale, setLocale: jest.fn(), isReady: true }),
}));
jest.mock('@oxy.so/core', () => ({ translate: (_locale: string, key: string) => key }));

import { renderHook } from '@testing-library/react';
import { useTranslation } from '@/lib/i18n/use-translation';

it('uses the _other form for zero when there is no _zero form', () => {
  locale = 'en-US';
  const { result } = renderHook(() => useTranslation());
  expect(result.current.t('threadSummary.messages', { count: 0 })).toBe('0 messages');
  expect(result.current.t('threadSummary.messages', { count: 1 })).toBe('1 message');
});

it('gives Arabic its dual form, not the English plural', () => {
  locale = 'ar-SA';
  const { result } = renderHook(() => useTranslation());
  const two = result.current.t('threadSummary.messages', { count: 2 });
  const eleven = result.current.t('threadSummary.messages', { count: 11 });
  expect(two).not.toBe(eleven);
  expect(two).not.toMatch(/threadSummary/);
});
