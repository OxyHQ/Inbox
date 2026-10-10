import { translate as coreTranslate } from '@oxy.so/core';
import enInbox from './locales/en';
import esInbox from './locales/es';
import caInbox from './locales/ca';
import frInbox from './locales/fr';
import deInbox from './locales/de';
import itInbox from './locales/it';
import ptInbox from './locales/pt';
import jaInbox from './locales/ja';
import koInbox from './locales/ko';
import zhInbox from './locales/zh';
import arInbox from './locales/ar';
import type { Locale, LocaleDict, LocaleNode, TranslationVars } from './types';

/**
 * Inbox-namespaced dictionaries loaded at module init. All 11 supported
 * locales are fully populated; missing keys fall back to core's dictionary
 * and then to the raw key for visibility.
 */
export const INBOX_DICTS: Partial<Record<Locale, LocaleDict>> = {
  'en-US': enInbox as LocaleDict,
  'es-ES': esInbox as LocaleDict,
  'ca-ES': caInbox as LocaleDict,
  'fr-FR': frInbox as LocaleDict,
  'de-DE': deInbox as LocaleDict,
  'it-IT': itInbox as LocaleDict,
  'pt-PT': ptInbox as LocaleDict,
  'ja-JP': jaInbox as LocaleDict,
  'ko-KR': koInbox as LocaleDict,
  'zh-CN': zhInbox as LocaleDict,
  'ar-SA': arInbox as LocaleDict,
};

function lookup(dict: LocaleDict | undefined, key: string): string | undefined {
  if (!dict) return undefined;
  const parts = key.split('.');
  let node: LocaleNode | LocaleNode[] | undefined = dict;
  for (const part of parts) {
    if (Array.isArray(node)) {
      const idx = Number.parseInt(part, 10);
      if (!Number.isInteger(idx)) return undefined;
      node = node[idx];
    } else if (node && typeof node === 'object') {
      node = (node as Record<string, LocaleNode | LocaleNode[]>)[part];
    } else {
      return undefined;
    }
  }
  return typeof node === 'string' ? node : undefined;
}

function interpolate(template: string, vars?: TranslationVars): string {
  if (!vars) return template;
  let out = template;
  for (const k of Object.keys(vars)) {
    out = out.replaceAll(`{{${k}}}`, String(vars[k]));
  }
  return out;
}

const pluralRules = new Map<string, Intl.PluralRules>();

/** The CLDR plural category of `count` in `locale` (`one`, `two`, `few`, `many`, `other`, …). */
function pluralCategory(locale: string, count: number): Intl.LDMLPluralRule {
  // A runtime without Intl.PluralRules gets the one/other split.
  if (typeof Intl === 'undefined' || typeof Intl.PluralRules !== 'function') {
    return count === 1 ? 'one' : 'other';
  }
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralRules.set(locale, rules);
  }
  return rules.select(count);
}

/**
 * Pick the plural variant of `key` for `vars.count`: `_zero` for an explicit
 * zero when the dictionary has one, then the locale's own CLDR category, then
 * `_other`. Arabic has six categories and was given English's two — "2
 * messages" took the `other` form — and a count of 0 with no `_zero` form
 * fell through to the base key, which does not exist, so the raw key showed.
 */
function pluralizeKey(
  key: string,
  vars: TranslationVars | undefined,
  dict: LocaleDict | undefined,
  locale = 'en-US',
): string {
  if (!vars || typeof vars.count !== 'number') return key;
  const count = vars.count;
  const candidates = [
    ...(count === 0 ? [`${key}_zero`] : []),
    `${key}_${pluralCategory(locale, count)}`,
    `${key}_other`,
  ];
  return candidates.find((candidate) => lookup(dict, candidate) != null) ?? key;
}

/**
 * Translate `key` in `locale`. Resolution order:
 *   1. Inbox-namespaced dict for the locale (all 11 locales).
 *   2. Core's `translate(locale, key, vars)` for shared strings such as
 *      `signin.*`, `signup.*`, etc. that live in `@oxy.so/core` dictionaries.
 *   3. English, so a string not translated yet never shows as its key.
 *   4. The raw key string, so a missing key surfaces visibly without
 *      breaking the UI.
 *
 * Pure, so code that runs outside (or above) the React tree — the locale
 * provider itself — translates exactly as `useTranslation` does.
 */
export function translate(locale: Locale, key: string, vars?: TranslationVars): string {
  const dict = INBOX_DICTS[locale];
  const resolvedKey = pluralizeKey(key, vars, dict, locale);

  const local = lookup(dict, resolvedKey);
  if (local != null) return interpolate(local, vars);

  const fromCore = coreTranslate(locale, resolvedKey, vars);
  if (fromCore !== resolvedKey) return fromCore;

  // A string not translated yet is shown in English, never as its key: a
  // missing key used to reach users verbatim — "notifications.push.channel.name"
  // as the Android notification channel's name in nine languages.
  const english = lookup(INBOX_DICTS['en-US'], pluralizeKey(key, vars, INBOX_DICTS['en-US']));
  if (english != null) return interpolate(english, vars);

  // Every layer missed — return the original key for visibility.
  return key;
}
