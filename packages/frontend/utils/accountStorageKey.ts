/**
 * A device-storage key owned by one account: `prefix` and the account scope,
 * URI-encoded, or `anonymous` when there is none. Every account-scoped key
 * (preferences, recent searches, compose recovery) is built here, so one
 * account's stored values can never be read under another's key.
 *
 * The output is what earlier builds stored under; changing it strands every
 * saved value.
 */
export function accountStorageKey(prefix: string, scope: string | null | undefined): string {
  return `${prefix}${encodeURIComponent(scope ?? 'anonymous')}`;
}
