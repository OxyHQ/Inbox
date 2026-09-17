/**
 * Canonical list of settings sections.
 *
 * Used by both the desktop sidebar (`SettingsNav`) and the mobile landing
 * screen (`/settings`) so they stay in lock-step. Each entry maps to a
 * typed-routes path under `/settings/...`, carries a Bloom icon, and a
 * semantic tint key (per-row colored IconCircle, iOS Settings style).
 */

import type { ComponentType } from 'react';

import type { Props as IconProps } from '@oxy.so/bloom/icons';
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

import type { SettingsTintKey } from './settings-tints';

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

/** A typed-routes path string for the settings section route. */
export type SettingsSectionPath =
  | '/settings/account'
  | '/settings/appearance'
  | '/settings/notifications'
  | '/settings/inbox-prefs'
  | '/settings/privacy'
  | '/settings/labels'
  | '/settings/contacts'
  | '/settings/ai'
  | '/settings/storage'
  | '/settings/advanced'
  | '/settings/about';

export interface SettingsSectionDef {
  key: SettingsSectionKey;
  /** Typed route path for `router.push()`. */
  path: SettingsSectionPath;
  /** Translation key for the display label. */
  labelKey: string;
  /** Translation key for the short landing-page description. */
  descriptionKey: string;
  /** Bloom icon component (rendered inside an `IconCircle`). */
  icon: ComponentType<IconProps>;
  /** Tint key for the per-row colored IconCircle background. */
  tint: SettingsTintKey;
  /** Whether this section requires authentication to access meaningfully. */
  requiresAuth: boolean;
}

export const SETTINGS_SECTIONS: readonly SettingsSectionDef[] = [
  {
    key: 'account',
    path: '/settings/account',
    labelKey: 'ui.settings.landing.sections.account',
    descriptionKey: 'ui.settings.landing.sections.accountDescription',
    icon: RiAccountCircleLine,
    tint: 'account',
    requiresAuth: true,
  },
  {
    key: 'appearance',
    path: '/settings/appearance',
    labelKey: 'ui.settings.landing.sections.appearance',
    descriptionKey: 'ui.settings.landing.sections.appearanceDescription',
    icon: RiPaletteLine,
    tint: 'appearance',
    requiresAuth: false,
  },
  {
    key: 'notifications',
    path: '/settings/notifications',
    labelKey: 'ui.settings.landing.sections.notifications',
    descriptionKey: 'ui.settings.landing.sections.notificationsDescription',
    icon: RiNotification3Line,
    tint: 'notifications',
    requiresAuth: true,
  },
  {
    key: 'inbox-prefs',
    path: '/settings/inbox-prefs',
    labelKey: 'ui.settings.landing.sections.inbox',
    descriptionKey: 'ui.settings.landing.sections.inboxDescription',
    icon: RiMailLine,
    tint: 'inbox',
    requiresAuth: false,
  },
  {
    key: 'privacy',
    path: '/settings/privacy',
    labelKey: 'ui.settings.landing.sections.privacy',
    descriptionKey: 'ui.settings.landing.sections.privacyDescription',
    icon: RiLockLine,
    tint: 'privacy',
    requiresAuth: true,
  },
  {
    key: 'labels',
    path: '/settings/labels',
    labelKey: 'ui.settings.landing.sections.labels',
    descriptionKey: 'ui.settings.landing.sections.labelsDescription',
    icon: RiPushpinLine,
    tint: 'labels',
    requiresAuth: true,
  },
  {
    key: 'contacts',
    path: '/settings/contacts',
    labelKey: 'ui.settings.landing.sections.contacts',
    descriptionKey: 'ui.settings.landing.sections.contactsDescription',
    icon: RiContactsBookLine,
    tint: 'contacts',
    requiresAuth: true,
  },
  {
    key: 'ai',
    path: '/settings/ai',
    labelKey: 'ui.settings.landing.sections.ai',
    descriptionKey: 'ui.settings.landing.sections.aiDescription',
    icon: RiSparklingLine,
    tint: 'ai',
    requiresAuth: true,
  },
  {
    key: 'storage',
    path: '/settings/storage',
    labelKey: 'ui.settings.landing.sections.storage',
    descriptionKey: 'ui.settings.landing.sections.storageDescription',
    icon: RiSaveLine,
    tint: 'storage',
    requiresAuth: true,
  },
  {
    key: 'advanced',
    path: '/settings/advanced',
    labelKey: 'ui.settings.landing.sections.advanced',
    descriptionKey: 'ui.settings.landing.sections.advancedDescription',
    icon: RiEqualizerLine,
    tint: 'advanced',
    requiresAuth: false,
  },
  {
    key: 'about',
    path: '/settings/about',
    labelKey: 'ui.settings.landing.sections.about',
    descriptionKey: 'ui.settings.landing.sections.aboutDescription',
    icon: RiInformationLine,
    tint: 'about',
    requiresAuth: false,
  },
];
