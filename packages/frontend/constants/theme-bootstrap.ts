import type { BloomThemeBootstrapConfig } from '@oxy.so/bloom/theme';

export const INBOX_THEME_STORAGE_KEY = 'inbox_theme_preference';

/** The document and provider share the device's last theme and existing mode choice. */
export const INBOX_THEME_BOOTSTRAP = {
  defaultMode: 'system',
  defaultColorPreset: 'oxy',
  modeStorageKey: INBOX_THEME_STORAGE_KEY,
  persistKey: 'inbox.bloom.theme',
} satisfies BloomThemeBootstrapConfig;
