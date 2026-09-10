/**
 * Mobile settings landing screen.
 *
 * Top: `SettingsHero` (account card or sign-in CTA).
 * Below: a stack of `SettingsCategoryCard`s, one per logical bucket:
 *  - Personal (Account, Notifications, Privacy)
 *  - Mail (Inbox, Labels, AI features, Storage)
 *  - System (Appearance, Advanced, About)
 *
 * Each row uses `SettingsCategoryRow` — a tinted `IconCircle` with the
 * section's signature color (iOS Settings convention: blue=Account,
 * purple=Appearance, red=Privacy, etc.) plus title + description + chevron.
 *
 * Locked rows (auth-gated when signed-out) still navigate so the user
 * lands on the section's auth gate, with a lock indicator on the right.
 */

import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOxy } from '@oxy.so/services';
import { H3 } from '@oxy.so/bloom/typography';
import { Lock_Stroke2_Corner0_Rounded } from '@oxy.so/bloom/icons';
import { useMinimizeOnScroll } from '@oxy.so/bloom/tab-bar';

import { useColors } from '@/constants/theme';
import { useTranslation } from '@/lib/i18n';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { useIsDesktopLayout } from '@/hooks/useIsDesktopLayout';
import { SettingsHero } from './SettingsHero';
import { SettingsCategoryCard } from './SettingsCategoryCard';
import { SettingsCategoryRow } from './SettingsCategoryRow';
import {
  SETTINGS_SECTIONS,
  type SettingsSectionDef,
  type SettingsSectionPath,
} from './sections-catalog';

type SectionBucketKey = 'personal' | 'mail' | 'system';

const BUCKETS: readonly {
  key: SectionBucketKey;
  titleKey: string;
  sectionKeys: readonly SettingsSectionDef['key'][];
}[] = [
  {
    key: 'personal',
    titleKey: 'ui.settings.landing.personal',
    sectionKeys: ['account', 'notifications', 'privacy'],
  },
  {
    key: 'mail',
    titleKey: 'ui.settings.landing.mail',
    sectionKeys: ['inbox-prefs', 'labels', 'ai', 'storage'],
  },
  {
    key: 'system',
    titleKey: 'ui.settings.landing.system',
    sectionKeys: ['appearance', 'advanced', 'about'],
  },
];

function findSection(key: SettingsSectionDef['key']): SettingsSectionDef {
  const match = SETTINGS_SECTIONS.find((s) => s.key === key);
  if (!match) {
    throw new Error(`SettingsLanding: unknown section key "${key}"`);
  }
  return match;
}

export function SettingsLanding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const isDesktopLayout = useIsDesktopLayout();
  const minimizeTabBarOnScroll = useMinimizeOnScroll();
  const colors = useColors();
  const { t } = useTranslation();
  const { isAuthenticated } = useOxy();

  const handleNavigate = useCallback(
    (path: SettingsSectionPath) => {
      router.push(path);
    },
    [router],
  );

  const buckets = useMemo(
    () =>
      BUCKETS.map((bucket) => ({
        ...bucket,
        sections: bucket.sectionKeys.map(findSection),
      })),
    [],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: isDesktopLayout ? 0 : insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <H3 style={styles.headerTitle}>{t('settings.title')}</H3>
      </View>

      <Animated.ScrollView
        style={styles.scroll}
        onScroll={minimizeTabBarOnScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: 16,
          paddingBottom: isDesktopLayout ? 0 : tabBarClearance + 40,
          paddingHorizontal: Math.max(insets.left, insets.right),
        }}
        showsVerticalScrollIndicator={false}
      >
        <SettingsHero />

        {buckets.map((bucket) => (
          <SettingsCategoryCard key={bucket.key} title={t(bucket.titleKey)}>
            {bucket.sections.map((section) => {
              const isLocked = section.requiresAuth && !isAuthenticated;
              return (
                <SettingsCategoryRow
                  key={section.key}
                  icon={section.icon}
                  tint={section.tint}
                  title={t(section.labelKey)}
                  description={t(section.descriptionKey)}
                  trailing={
                    isLocked ? (
                      <Lock_Stroke2_Corner0_Rounded
                        size="sm"
                        style={{ color: colors.icon, opacity: 0.6 }}
                      />
                    ) : null
                  }
                  onPress={() => handleNavigate(section.path)}
                />
              );
            })}
          </SettingsCategoryCard>
        ))}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 28,
    lineHeight: 34,
  },
  scroll: {
    flex: 1,
  },
});
