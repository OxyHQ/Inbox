/** Navigation metadata shared by the Bloom settings modal and bookmarked routes. */
import { RiAccountCircleLine } from '@oxy.so/bloom/icons/RiAccountCircleLine';
import { RiContactsBookLine } from '@oxy.so/bloom/icons/RiContactsBookLine';
import { RiEqualizerLine } from '@oxy.so/bloom/icons/RiEqualizerLine';
import { RiInformationLine } from '@oxy.so/bloom/icons/RiInformationLine';
import { RiLockLine } from '@oxy.so/bloom/icons/RiLockLine';
import { RiMailLine } from '@oxy.so/bloom/icons/RiMailLine';
import { RiNotification3Line } from '@oxy.so/bloom/icons/RiNotification3Line';
import { RiPaletteLine } from '@oxy.so/bloom/icons/RiPaletteLine';
import { RiPushpinLine } from '@oxy.so/bloom/icons/RiPushpinLine';
import { RiSaveLine } from '@oxy.so/bloom/icons/RiSaveLine';
import { RiSparklingLine } from '@oxy.so/bloom/icons/RiSparklingLine';
import type { SettingsIcon } from '@oxy.so/bloom/settings-modal';

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
