/** Navigation metadata shared by the Bloom settings modal and bookmarked routes. */
import type { SettingsIcon } from '@oxy.so/bloom/settings-modal';
import {
  RiAccountCircleLine,
  RiContactsBookLine,
  RiNotification3Line,
  RiMailLine,
  RiPaletteLine,
  RiLockLine,
  RiPushpinLine,
  RiSparklingLine,
  RiSaveLine,
  RiEqualizerLine,
  RiInformationLine,
} from '@oxy.so/bloom/icons';

/** A canonical settings section slug used in URLs and as a key. */
export type SettingsSectionKey =
  | 'account'
  | 'appearance'
  | 'notifications'
  | 'inbox-prefs'
  | 'privacy'
  | 'labels'
  | 'contacts'
  | 'ai'
  | 'storage'
  | 'advanced'
  | 'about';

export interface SettingsSectionDef {
  key: SettingsSectionKey;
  /** Translation key for the display label. */
  labelKey: string;
  /** Bloom settings navigation icon. */
  icon: SettingsIcon;
  /** Whether this section requires authentication to access meaningfully. */
  requiresAuth: boolean;
}

export const SETTINGS_SECTIONS: readonly SettingsSectionDef[] = [
  {
    key: 'account',
    labelKey: 'ui.settings.landing.sections.account',
    icon: RiAccountCircleLine,
    requiresAuth: true,
  },
  {
    key: 'appearance',
    labelKey: 'ui.settings.landing.sections.appearance',
    icon: RiPaletteLine,
    requiresAuth: false,
  },
  {
    key: 'notifications',
    labelKey: 'ui.settings.landing.sections.notifications',
    icon: RiNotification3Line,
    requiresAuth: true,
  },
  {
    key: 'inbox-prefs',
    labelKey: 'ui.settings.landing.sections.inbox',
    icon: RiMailLine,
    requiresAuth: false,
  },
  {
    key: 'privacy',
    labelKey: 'ui.settings.landing.sections.privacy',
    icon: RiLockLine,
    requiresAuth: true,
  },
  {
    key: 'labels',
    labelKey: 'ui.settings.landing.sections.labels',
    icon: RiPushpinLine,
    requiresAuth: true,
  },
  {
    key: 'contacts',
    labelKey: 'ui.settings.landing.sections.contacts',
    icon: RiContactsBookLine,
    requiresAuth: true,
  },
  {
    key: 'ai',
    labelKey: 'ui.settings.landing.sections.ai',
    icon: RiSparklingLine,
    requiresAuth: true,
  },
  {
    key: 'storage',
    labelKey: 'ui.settings.landing.sections.storage',
    icon: RiSaveLine,
    requiresAuth: true,
  },
  {
    key: 'advanced',
    labelKey: 'ui.settings.landing.sections.advanced',
    icon: RiEqualizerLine,
    requiresAuth: false,
  },
  {
    key: 'about',
    labelKey: 'ui.settings.landing.sections.about',
    icon: RiInformationLine,
    requiresAuth: false,
  },
];
