/** The import result reads "Imported X of Y", with Y's plural, in the toast and the settings row alike. */
import { translate } from '@/lib/i18n/translate';
import { SUPPORTED_LOCALES } from '@/lib/i18n/types';
import { importSummary } from '@/utils/importSummary';

const en = (key: string, vars?: Record<string, string | number>) => translate('en-US', key, vars);

describe('importSummary', () => {
  it('names both numbers and takes the plural from the total', () => {
    expect(importSummary(en, { imported: 2, total: 3 })).toBe('Imported 2 of 3 emails.');
    expect(importSummary(en, { imported: 1, total: 1 })).toBe('Imported 1 of 1 email.');
    expect(importSummary(en, { imported: 0, total: 4 })).toBe('Imported 0 of 4 emails.');
  });

  it('leaves no placeholder unfilled in any locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const text = importSummary((key, vars) => translate(locale, key, vars), {
        imported: 2,
        total: 3,
      });
      expect(text).not.toMatch(/\{\{|\}\}/);
      expect(text).toContain('2');
      expect(text).toContain('3');
    }
  });
});
