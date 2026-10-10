/**
 * The value, or a test failure that names what was missing. Tests use this in
 * place of a non-null assertion (`!`), which would only fail later, on a
 * TypeError far from the cause.
 */
export function defined<T>(value: T | null | undefined, what = 'value'): T {
  if (value === null || value === undefined) throw new Error(`expected ${what} to be present`);
  return value;
}
