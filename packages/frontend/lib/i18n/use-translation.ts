import { useCallback } from 'react';
import { useLocale } from './locale-context';
import { translate } from './translate';
import type { Locale, TranslateFn } from './types';

interface UseTranslationResult {
  t: TranslateFn;
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
}

/**
 * Returns the translation function plus the current locale and a setter.
 * Resolution order is `translate`'s (`./translate.ts`).
 */
export function useTranslation(): UseTranslationResult {
  const { locale, setLocale } = useLocale();

  const t = useCallback<TranslateFn>((key, vars) => translate(locale, key, vars), [locale]);

  return { t, locale, setLocale };
}
