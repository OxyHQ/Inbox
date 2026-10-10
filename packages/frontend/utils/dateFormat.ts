/**
 * `Intl.DateTimeFormat`s in the app's language, built once per locale and
 * options. Not the device's: with Spanish chosen in the app on an English
 * device, `toLocale*(undefined)` wrote "Sat, Oct 10". And not built per call:
 * a list formats one date per row, and an options object defeats the engine's
 * own formatter cache.
 */

const cache = new Map<string, Intl.DateTimeFormat>();

export function dateFormatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = cache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    cache.set(key, formatter);
  }
  return formatter;
}
