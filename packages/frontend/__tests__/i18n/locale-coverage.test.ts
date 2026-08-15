import ar from '@/lib/i18n/locales/ar';
import ca from '@/lib/i18n/locales/ca';
import de from '@/lib/i18n/locales/de';
import en from '@/lib/i18n/locales/en';
import es from '@/lib/i18n/locales/es';
import fr from '@/lib/i18n/locales/fr';
import it from '@/lib/i18n/locales/it';
import ja from '@/lib/i18n/locales/ja';
import ko from '@/lib/i18n/locales/ko';
import pt from '@/lib/i18n/locales/pt';
import zh from '@/lib/i18n/locales/zh';
import type { LocaleDict, LocaleNode } from '@/lib/i18n/types';

const dictionaries: Record<string, LocaleDict> = { ar, ca, de, en, es, fr, it, ja, ko, pt, zh };

function flatten(node: LocaleNode, prefix = ''): Record<string, string> {
  if (typeof node === 'string') return { [prefix]: node };
  if (Array.isArray(node)) {
    return Object.fromEntries(
      node.flatMap((child, index) => Object.entries(flatten(child, `${prefix}.${index}`))),
    );
  }
  return Object.fromEntries(
    Object.entries(node).flatMap(([key, child]) =>
      Object.entries(flatten(child, prefix ? `${prefix}.${key}` : key)),
    ),
  );
}

function placeholders(value: string): string[] {
  return [...value.matchAll(/{{([^}]+)}}/g)].map((match) => match[1]).sort();
}

describe('Inbox UI locale coverage', () => {
  const englishUi = flatten(en.ui);

  for (const [locale, dictionary] of Object.entries(dictionaries)) {
    if (locale === 'en') continue;
    test(`${locale} has every ui key and matching interpolation variables`, () => {
      const translatedUi = flatten(dictionary.ui);
      expect(Object.keys(translatedUi).sort()).toEqual(Object.keys(englishUi).sort());
      for (const key of Object.keys(englishUi)) {
        expect(translatedUi[key]).not.toBe(key);
        expect(placeholders(translatedUi[key])).toEqual(placeholders(englishUi[key]));
      }
    });
  }
});
