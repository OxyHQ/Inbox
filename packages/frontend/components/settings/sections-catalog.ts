/**
 * Canonical list of settings sections.
 *
 * Used by both the desktop sidebar (`SettingsNav`) and the mobile landing
 * screen (`/settings`) so they stay in lock-step. Each entry maps to a
 * typed-routes path under `/settings/...`, carries a Bloom icon, and a
 * semantic tint key (per-row colored IconCircle, iOS Settings style).
 */

import type { ComponentType } from 'react';

import type { Props as IconProps } from '@oxyhq/bloom/icons';
import {
  UserCircle_Stroke2_Corner0_Rounded,
  Contacts_Stroke2_Corner2_Rounded,
  Bell_Stroke2_Corner0_Rounded,
  Envelope_Stroke2_Corner0_Rounded,
  ColorPalette_Stroke2_Corner0_Rounded,
  Lock_Stroke2_Corner0_Rounded,
  Pin_Stroke2_Corner0_Rounded,
  Sparkle_Stroke2_Corner0_Rounded,
  FloppyDisk_Stroke2_Corner0_Rounded,
  SettingsSliderVertical_Stroke2_Corner0_Rounded,
  CircleInfo_Stroke2_Corner0_Rounded,
} from '@oxyhq/bloom/icons';

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
    icon: UserCircle_Stroke2_Corner0_Rounded,
    tint: 'account',
    requiresAuth: true,
  },
  {
    key: 'appearance',
    path: '/settings/appearance',
    labelKey: 'ui.settings.landing.sections.appearance',
    descriptionKey: 'ui.settings.landing.sections.appearanceDescription',
    icon: ColorPalette_Stroke2_Corner0_Rounded,
    tint: 'appearance',
    requiresAuth: false,
  },
  {
    key: 'notifications',
    path: '/settings/notifications',
    labelKey: 'ui.settings.landing.sections.notifications',
    descriptionKey: 'ui.settings.landing.sections.notificationsDescription',
    icon: Bell_Stroke2_Corner0_Rounded,
    tint: 'notifications',
    requiresAuth: true,
  },
  {
    key: 'inbox-prefs',
    path: '/settings/inbox-prefs',
    labelKey: 'ui.settings.landing.sections.inbox',
    descriptionKey: 'ui.settings.landing.sections.inboxDescription',
    icon: Envelope_Stroke2_Corner0_Rounded,
    tint: 'inbox',
    requiresAuth: false,
  },
  {
    key: 'privacy',
    path: '/settings/privacy',
    labelKey: 'ui.settings.landing.sections.privacy',
    descriptionKey: 'ui.settings.landing.sections.privacyDescription',
    icon: Lock_Stroke2_Corner0_Rounded,
    tint: 'privacy',
    requiresAuth: true,
  },
  {
    key: 'labels',
    path: '/settings/labels',
    labelKey: 'ui.settings.landing.sections.labels',
    descriptionKey: 'ui.settings.landing.sections.labelsDescription',
    icon: Pin_Stroke2_Corner0_Rounded,
    tint: 'labels',
    requiresAuth: true,
  },
  {
    key: 'contacts',
    path: '/settings/contacts',
    labelKey: 'ui.settings.landing.sections.contacts',
    descriptionKey: 'ui.settings.landing.sections.contactsDescription',
    icon: Contacts_Stroke2_Corner2_Rounded,
    tint: 'contacts',
    requiresAuth: true,
  },
  {
    key: 'ai',
    path: '/settings/ai',
    labelKey: 'ui.settings.landing.sections.ai',
    descriptionKey: 'ui.settings.landing.sections.aiDescription',
    icon: Sparkle_Stroke2_Corner0_Rounded,
    tint: 'ai',
    requiresAuth: true,
  },
  {
    key: 'storage',
    path: '/settings/storage',
    labelKey: 'ui.settings.landing.sections.storage',
    descriptionKey: 'ui.settings.landing.sections.storageDescription',
    icon: FloppyDisk_Stroke2_Corner0_Rounded,
    tint: 'storage',
    requiresAuth: true,
  },
  {
    key: 'advanced',
    path: '/settings/advanced',
    labelKey: 'ui.settings.landing.sections.advanced',
    descriptionKey: 'ui.settings.landing.sections.advancedDescription',
    icon: SettingsSliderVertical_Stroke2_Corner0_Rounded,
    tint: 'advanced',
    requiresAuth: false,
  },
  {
    key: 'about',
    path: '/settings/about',
    labelKey: 'ui.settings.landing.sections.about',
    descriptionKey: 'ui.settings.landing.sections.aboutDescription',
    icon: CircleInfo_Stroke2_Corner0_Rounded,
    tint: 'about',
    requiresAuth: false,
  },
];
