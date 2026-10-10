/**
 * Every key the code asks for exists in every language. A missing key used
 * to reach users verbatim ("notifications.push.channel.name" as an Android
 * channel name); English is now the runtime fallback, and this keeps the
 * fallback from being what anyone sees.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import ar from '@/lib/i18n/locales/ar';
import ca from '@/lib/i18n/locales/ca';
import de from '@/lib/i18n/locales/de';
import en from '@/lib/i18n/locales/en';
import es from '@/lib/i18n/locales/es';
import fr from '@/lib/i18n/locales/fr';
import italian from '@/lib/i18n/locales/it';
import ja from '@/lib/i18n/locales/ja';
import ko from '@/lib/i18n/locales/ko';
import pt from '@/lib/i18n/locales/pt';
import zh from '@/lib/i18n/locales/zh';

const dictionaries = { ar, ca, de, en, es, fr, it: italian, ja, ko, pt, zh } as Record<string, unknown>;
const root = resolve(__dirname, '../..');
const SKIP = new Set(['node_modules', 'dist', 'dist-android', '__tests__', '.expo', 'android']);

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(tsx?|jsx?)$/.test(name) ? [path] : [];
  });
}

function lookup(dict: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    dict,
  );
}

const used = new Set<string>();
for (const dir of ['app', 'components', 'hooks', 'utils', 'lib', 'contexts', 'services']) {
  for (const file of sources(join(root, dir))) {
    for (const match of readFileSync(file, 'utf8').matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) used.add(match[1]);
  }
}

it('finds the keys it checks', () => {
  expect(used.size).toBeGreaterThan(300);
});

for (const [locale, dictionary] of Object.entries(dictionaries)) {
  it(`${locale} has every key the code uses`, () => {
    const missing = [...used].filter(
      (key) =>
        typeof lookup(dictionary, key) !== 'string' &&
        typeof lookup(dictionary, `${key}_other`) !== 'string',
    );
    expect(missing).toEqual([]);
  });
}

it('is checked against English too', () => {
  expect(typeof lookup(en, 'common.cancel')).toBe('string');
});
