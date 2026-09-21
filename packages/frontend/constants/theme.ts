/**
 * Theme colors for the inbox app.
 *
 * Provides the `useColors()` hook that merges Bloom's dynamic theme colors
 * (driven by the active `colorPreset` — Oxy purple by default) with a small set
 * of inbox-specific domain tokens for things Bloom doesn't model directly
 * (read/unread row state, starred yellow, swipe action colors, etc.).
 *
 * Brand colors (primary, active states, FABs, search bg) come from Bloom so
 * the inbox automatically follows the user's selected accent.
 */

import { useMemo } from 'react';
import { Platform } from 'react-native';
import { useTheme } from '@oxy.so/bloom/theme';

/** Inbox names for semantic Bloom roles. No independent light/dark palette. */
export function useColors() {
  const { colors: bloom } = useTheme();
  return useMemo(() => ({
    text: bloom.text, background: bloom.background, surface: bloom.backgroundSecondary,
    surfaceVariant: bloom.backgroundTertiary, tint: bloom.primary, icon: bloom.icon,
    border: bloom.border, secondaryText: bloom.textSecondary, primary: bloom.primary,
    primaryForeground: bloom.primaryForeground, error: bloom.error,
    primaryContainer: bloom.primarySubtle, sidebarBackground: bloom.background,
    sidebarItemActive: bloom.primarySubtle, sidebarItemActiveText: bloom.primarySubtleForeground,
    composeFab: bloom.tertiarySubtle, composeFabText: bloom.tertiarySubtleForeground,
    composeFabIcon: bloom.tertiarySubtleForeground, searchBackground: bloom.backgroundSecondary,
    selectedRow: bloom.primarySubtle, unread: bloom.text, read: bloom.textSecondary,
    sidebarText: bloom.text, searchText: bloom.text, searchPlaceholder: bloom.textSecondary,
    starred: bloom.warningSubtleForeground, danger: bloom.error, success: bloom.success,
    warning: bloom.warning, swipeArchive: bloom.success, swipeDelete: bloom.error,
    swipeRead: bloom.info, swipeSnooze: bloom.warning,
    swipeArchiveForeground: bloom.successForeground, swipeDeleteForeground: bloom.errorForeground,
    swipeReadForeground: bloom.infoForeground, swipeSnoozeForeground: bloom.warningForeground,
    avatarColors: [bloom.primarySubtle, bloom.secondarySubtle, bloom.tertiarySubtle],
    avatarForegrounds: [bloom.primarySubtleForeground, bloom.secondarySubtleForeground, bloom.tertiarySubtleForeground],
  }), [bloom]);
}

// ── Fonts ───────────────────────────────────────────────────────────

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
