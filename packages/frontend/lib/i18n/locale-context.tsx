import { LocaleProvider as BloomLocaleProvider } from '@oxy.so/bloom/locale';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { I18nManager, Platform } from 'react-native';
import { toast } from '@oxy.so/bloom/toast';
import { useOxy, useUpdateProfile } from '@oxy.so/services';
import { coerceToSupportedLocale, isRTLLocale } from '@oxy.so/core';
import { translate } from './translate';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from './types';

/**
 * How long a wrong native direction must persist before the user is told to
 * restart. The locale settles asynchronously (the stored guest choice, then the
 * account's), so the first render can briefly hold a locale of the other
 * direction; that moment must not ask for a restart.
 */
const DIRECTION_SETTLE_MS = 1500;

/**
 * Point React Native's layout direction at the UI language's.
 *
 * `allowRTL(true)` used to run unconditionally at module load, which lets RN
 * follow the DEVICE's direction: on an Arabic or Hebrew phone an English UI
 * came up mirrored. Both calls now take the UI language's direction.
 *
 * RN reads the direction once, at startup, so a change only applies after a
 * reload. `expo-updates` (whose `reloadAsync` could do that) is not a
 * dependency of this app, so the caller asks the user to restart instead.
 *
 * @returns Whether the running app is laid out the other way, i.e. a restart
 *   is needed. Always `false` on the web, where `dir` is set on the document.
 */
export function applyNativeLayoutDirection(rtl: boolean): boolean {
  if (Platform.OS === 'web') return false;
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  return I18nManager.isRTL !== rtl;
}

/**
 * Coerce a canonical BCP-47 locale from the SDK down to a locale this app
 * actually ships a dictionary for. Delegates to `@oxy.so/core`'s
 * `coerceToSupportedLocale` (exact catalog match, else the closest supported
 * locale sharing the same base language — `es-MX` -> `es-ES` — else the app
 * default) rather than re-deriving that same algorithm locally; every Oxy app
 * used to hand-roll this, which is why it moved into the SDK
 * (see ADR 0022, `@oxy.so/services`' `OxyProvider.language`).
 */
function coerceLocale(value: string | null | undefined): Locale {
  return coerceToSupportedLocale(value, SUPPORTED_LOCALES, DEFAULT_LOCALE) as Locale;
}

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  isReady: boolean;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

interface LocaleProviderProps {
  children: React.ReactNode;
}

export function LocaleProvider({ children }: LocaleProviderProps) {
  const { currentLanguage, currentLanguages, isAuthenticated, setLanguage } = useOxy();
  const updateProfile = useUpdateProfile();

  // The active locale is DERIVED from the SDK's centralized `currentLanguage`
  // — the account's primary locale when signed in, else the guest/device
  // locale — coerced to a locale this app has a dictionary for. The SDK owns
  // account-vs-device resolution and hydration, so there is nothing local to
  // store or await here.
  const locale = useMemo<Locale>(() => coerceLocale(currentLanguage), [currentLanguage]);

  const setLocale = useCallback(
    async (next: Locale) => {
      if (!SUPPORTED_LOCALES.includes(next)) return;
      if (isAuthenticated) {
        // Write the account's ordered locales, primary first, preserving any
        // additional locales the user has chosen.
        const rest = currentLanguages.filter((entry) => entry !== next);
        await updateProfile.mutateAsync({ languages: [next, ...rest] });
      } else {
        // Guests hold a single locally-stored locale, owned by the SDK.
        await setLanguage(next);
      }
    },
    [isAuthenticated, currentLanguages, updateProfile, setLanguage],
  );

  // Keep the layout direction in sync with the active locale.
  const rtl = isRTLLocale(locale);
  const restartNoticeFor = useRef<boolean | null>(null);
  useEffect(() => {
    // On the web, `forceRTL` does nothing: the document's own `lang` and `dir`
    // are what the browser, screen readers and Bloom (`useIsRtl` reads
    // `documentElement.dir`) go by. They stayed `en` / left-to-right, so Arabic
    // was laid out backwards and read aloud with an English voice.
    if (Platform.OS === 'web') {
      if (typeof document !== 'undefined') {
        document.documentElement.lang = locale;
        document.documentElement.dir = rtl ? 'rtl' : 'ltr';
      }
      return;
    }
    if (!applyNativeLayoutDirection(rtl)) return;
    // Once per direction: switching between two languages of the same
    // direction is not a second reason to restart.
    if (restartNoticeFor.current === rtl) return;
    const timer = setTimeout(() => {
      restartNoticeFor.current = rtl;
      toast.info(translate(locale, 'ui.layoutDirection.restartRequired'), { duration: 10_000 });
    }, DIRECTION_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [locale, rtl]);

  const value = useMemo<LocaleContextValue>(
    // Hydration is owned by the SDK; the derived locale is always immediately
    // available, so the context is ready from first paint.
    () => ({ locale, setLocale, isReady: true }),
    [locale, setLocale],
  );

  return (
    <LocaleContext.Provider value={value}>
      <BloomLocaleProvider locale={locale}>{children}</BloomLocaleProvider>
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used inside <LocaleProvider>. Check app/_layout.tsx.');
  }
  return ctx;
}
