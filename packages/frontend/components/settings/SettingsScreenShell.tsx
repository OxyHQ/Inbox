/**
 * Shared shell for every settings subscreen.
 *
 * Provides:
 *  - Mobile: a top header with back chevron + title (no native large title —
 *    we keep the chrome consistent across iOS/Android/web).
 *  - Desktop: a slim header with the section title (back chevron hidden,
 *    since the sidebar is permanent and the breadcrumb is implicit).
 *  - Safe-area-aware vertical and landscape horizontal padding.
 *  - A `ScrollView` body with a max-width content rail on web and proper
 *    bottom inset so floating elements don't overlap the last row.
 *
 * Children are rendered inside the scroll view. Pass `scrollable={false}`
 * to opt out (e.g. for a screen that needs a fixed-height layout).
 */

import React from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { H3, Text } from '@oxy.so/bloom/typography';
import { IconButton } from '@oxy.so/bloom/button';
import { ChevronLeft_Stroke2_Corner0_Rounded } from '@oxy.so/bloom/icons';
import { useMinimizeOnScroll } from '@oxy.so/bloom/tab-bar';

import { useGoBack } from '@/hooks/useGoBack';
import { useColors } from '@/constants/theme';
import { useTranslation } from '@/lib/i18n';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { useIsDesktopLayout } from '@/hooks/useIsDesktopLayout';

interface SettingsScreenShellProps {
  title: string;
  /** Optional supplemental description shown under the header title. */
  subtitle?: string;
  /** Right-aligned header accessory (e.g. Save button). */
  headerRight?: React.ReactNode;
  /** Whether to render content inside a ScrollView (default true). */
  scrollable?: boolean;
  children: React.ReactNode;
}

export function SettingsScreenShell({
  title,
  subtitle,
  headerRight,
  scrollable = true,
  children,
}: SettingsScreenShellProps) {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const isDesktopLayout = useIsDesktopLayout();
  const minimizeTabBarOnScroll = useMinimizeOnScroll();
  const colors = useColors();
  const { t } = useTranslation();
  const showBack = !isDesktopLayout;

  const handleBack = useGoBack('/settings');

  const headerTopPad = isDesktopLayout ? 0 : insets.top;
  const contentBottomPad = isDesktopLayout ? 0 : tabBarClearance + 32;
  const horizontalLandscapePad = Math.max(insets.left, insets.right);

  const body = (
    <View style={[styles.bodyContainer, { paddingHorizontal: horizontalLandscapePad }]}>
      {children}
    </View>
  );

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: headerTopPad },
      ]}
    >
      <View
        style={[
          styles.header,
          { borderBottomColor: colors.border, paddingHorizontal: horizontalLandscapePad + 4 },
        ]}
      >
        {showBack ? (
          <IconButton
            onPress={handleBack}
            size="small"
            accessibilityLabel={t('common.back')}
            icon={<ChevronLeft_Stroke2_Corner0_Rounded size="md" style={{ color: colors.icon }} />}
          />
        ) : (
          <View style={styles.headerSpacerLeft} />
        )}

        <View style={styles.headerTitleWrap}>
          <H3 style={styles.headerTitle} numberOfLines={1}>{title}</H3>
          {subtitle ? (
            <Text style={[styles.headerSubtitle, { color: colors.secondaryText }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={styles.headerRight}>{headerRight}</View>
      </View>

      {scrollable ? (
        <Animated.ScrollView
          style={styles.scroll}
          onScroll={minimizeTabBarOnScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingBottom: contentBottomPad, paddingTop: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {body}
        </Animated.ScrollView>
      ) : (
        body
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
    minHeight: 56,
  },
  headerSpacerLeft: {
    width: 12,
  },
  headerTitleWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    lineHeight: 28,
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 8,
  },
  scroll: {
    flex: 1,
  },
  bodyContainer: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    gap: 4,
  },
});
