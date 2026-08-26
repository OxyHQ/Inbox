/**
 * Color preset picker — grid of swatches that drives the active Bloom
 * `colorPreset`. Reads and writes the persisted preference from
 * `useThemeContext()`; the chosen preset is propagated to
 * `BloomThemeProvider`, so every brand-tinted token (FAB, sidebar active,
 * search bg, primary buttons, links) follows the selection in real time.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { APP_COLOR_PRESETS, COLOR_PRESET_REGISTRY, FREE_COLOR_NAMES } from '@oxyhq/bloom/theme';
import type { AppColorName } from '@oxyhq/bloom/theme';
import { Check_Stroke2_Corner0_Rounded } from '@oxyhq/bloom/icons';

import { useThemeContext } from '@/contexts/theme-context';
import { useColors } from '@/constants/theme';

// Both lists are derived from Bloom's own registry, whose entries already carry
// the swatch colour and the human-readable name. A `Record<AppColorName, string>`
// maintained here would turn every preset Bloom adds into a compile error in this
// app for no editorial reason — the list went from 18 entries to 64 in Bloom 1.0.

// Keyed over the WHOLE registry, because the persisted preference may name a
// gated preset that the grid below will not offer.
const PRESET_LABELS = new Map<AppColorName, string>(
  COLOR_PRESET_REGISTRY.map((preset) => [preset.name, preset.displayName]),
);

// Filtered by FREE_COLOR_NAMES, never by APP_COLOR_NAMES. Bloom's own source
// spells out why: a consumer "must NOT start from `APP_COLOR_NAMES` and add the
// unlocked ones, which yields the gated presets to everybody". Inbox has no
// entitlement plumbing, so the free set is the whole of what it may offer — of
// Bloom 1.x's 64 presets, `oxy` and `faircoin` are handle-gated and `mono` is
// premium, leaving 61. The registry is already in picker order, so filtering it
// preserves that order exactly.
const FREE_PRESETS = COLOR_PRESET_REGISTRY.filter((preset) =>
  FREE_COLOR_NAMES.includes(preset.name),
);

export function ColorPresetPicker() {
  const { colorPreset, setColorPreset } = useThemeContext();
  const colors = useColors();

  const activeLabel = PRESET_LABELS.get(colorPreset) ?? colorPreset;

  return (
    <View style={styles.root}>
      <View style={styles.activeRow}>
        <View style={[styles.activeDot, { backgroundColor: APP_COLOR_PRESETS[colorPreset].hex }]} />
        <Text style={[styles.activeLabel, { color: colors.secondaryText }]}>
          {activeLabel}
        </Text>
      </View>

      <View style={styles.grid}>
        {FREE_PRESETS.map((preset) => {
          const isActive = preset.name === colorPreset;
          return (
            <Pressable
              key={preset.name}
              onPress={() => setColorPreset(preset.name)}
              accessibilityRole="button"
              accessibilityLabel={`Use ${preset.displayName} accent color`}
              accessibilityState={{ selected: isActive }}
              style={({ pressed }) => [
                styles.swatchCell,
                pressed && { opacity: 0.75 },
              ]}
            >
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: preset.hex },
                  isActive && [styles.swatchActive, { borderColor: colors.text }],
                ]}
              >
                {isActive ? (
                  <Check_Stroke2_Corner0_Rounded
                    size="sm"
                    style={{ color: '#FFFFFF' }}
                  />
                ) : null}
              </View>
              <Text
                style={[styles.swatchLabel, { color: colors.secondaryText }]}
                numberOfLines={1}
              >
                {preset.displayName}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const SWATCH_SIZE = 32;

const styles = StyleSheet.create({
  root: {
    gap: 12,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  activeLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    ...Platform.select({
      web: { rowGap: 14, columnGap: 12 },
      default: {},
    }),
  },
  swatchCell: {
    width: 52,
    alignItems: 'center',
    gap: 4,
  },
  swatch: {
    width: SWATCH_SIZE,
    height: SWATCH_SIZE,
    borderRadius: SWATCH_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchActive: {
    borderWidth: 2,
  },
  swatchLabel: {
    fontSize: 11,
    textAlign: 'center',
  },
});
