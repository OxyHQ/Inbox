import type { BloomThemeBootstrapConfig } from '@oxy.so/bloom/theme';

export const INBOX_THEME_STORAGE_KEY = 'inbox_theme_preference';

/** The document and provider read the same existing device preference. */
export const INBOX_THEME_BOOTSTRAP = {
  defaultMode: 'system',
  defaultColorPreset: 'oxy',
  modeStorageKey: INBOX_THEME_STORAGE_KEY,
} satisfies BloomThemeBootstrapConfig;
