import type { TranslateFn } from '@/lib/i18n/types';

/** The result of an `.eml` import, as `emailApi.importMessages` returns it. */
export interface ImportResult {
  imported: number;
  total: number;
}

/**
 * "Imported 2 of 3 emails.": the string takes `imported` and the total as
 * `count`, which also chooses its plural. The toast and the settings row both
 * say it, so neither can pass the total under another name (the toast passed
 * `total`, leaving `{{count}}` unfilled and the plural unchosen).
 */
export function importSummary(t: TranslateFn, result: ImportResult): string {
  return t('ui.settings.advanced.imported', { imported: result.imported, count: result.total });
}
