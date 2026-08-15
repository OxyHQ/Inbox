/**
 * Privacy subscreen — tracking protection + sender trust.
 *
 * Today the underlying protections are enabled by default and not per-row
 * configurable. We surface them as disabled toggles so users can see the
 * surface area, with an admonition that explains the roadmap.
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Admonition } from '@oxyhq/bloom/admonition';
import {
  ChainLink_Stroke2_Corner0_Rounded,
  CircleBanSign_Stroke2_Corner0_Rounded,
  EyeSlash_Stroke2_Corner0_Rounded,
  Verified_Stroke2_Corner2_Rounded,
} from '@oxyhq/bloom/icons';
import { Switch } from '@oxyhq/bloom/switch';
import { Text } from '@oxyhq/bloom/typography';

import { SectionHeader } from '@/components/settings/SectionHeader';
import { useColors } from '@/constants/theme';
import { useTranslation } from '@/lib/i18n';

interface DisabledToggleProps {
  title: string;
  description: string;
}

const NOOP = () => {
  // No-op stub for the disabled switches — wired once server-backed privacy
  // preferences ship. Each protection is already enabled by default.
};

function DisabledToggle({ title, description }: DisabledToggleProps) {
  const colors = useColors();

  return (
    <View style={styles.inlineToggle}>
      <View style={styles.inlineToggleText}>
        <Text style={[styles.inlineToggleTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.inlineToggleSub, { color: colors.secondaryText }]}>
          {description}
        </Text>
      </View>
      <Switch value onValueChange={NOOP} disabled />
    </View>
  );
}

export function PrivacySection() {
  const colors = useColors();
  const { t } = useTranslation();

  return (
    <View style={styles.root}>
      <Admonition type="info">
        {t('ui.settings.privacy.info')}
      </Admonition>

      <View style={styles.subsection}>
        <SectionHeader icon={EyeSlash_Stroke2_Corner0_Rounded} title={t('ui.settings.privacy.tracking')} />
        <View style={styles.toggleGroup}>
          <DisabledToggle
            title={t('ui.settings.privacy.blockImages')}
            description={t('ui.settings.privacy.blockImagesDescription')}
          />
          <DisabledToggle
            title={t('ui.settings.privacy.hideIp')}
            description={t('ui.settings.privacy.hideIpDescription')}
          />
          <DisabledToggle
            title={t('ui.settings.privacy.stripTracking')}
            description={t('ui.settings.privacy.stripTrackingDescription')}
          />
        </View>
      </View>

      <View style={styles.subsection}>
        <SectionHeader icon={Verified_Stroke2_Corner2_Rounded} title={t('ui.settings.privacy.trust')} />
        <View style={styles.toggleGroup}>
          <DisabledToggle
            title={t('ui.settings.privacy.verification')}
            description={t('ui.settings.privacy.verificationDescription')}
          />
          <Pressable
            disabled
            style={styles.blockListRow}
            accessibilityRole="button"
            accessibilityLabel={t('ui.settings.privacy.blockList')}
            accessibilityState={{ disabled: true }}
          >
            <CircleBanSign_Stroke2_Corner0_Rounded
              size="md"
              style={{ color: colors.icon, opacity: 0.6 }}
            />
            <View style={styles.inlineToggleText}>
              <Text style={[styles.inlineToggleTitle, { color: colors.text, opacity: 0.6 }]}>
                {t('ui.settings.privacy.blockListTitle')}
              </Text>
              <Text style={[styles.inlineToggleSub, { color: colors.secondaryText }]}>
                {t('ui.settings.privacy.blockListEmpty')}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      <View style={styles.subsection}>
        <SectionHeader icon={ChainLink_Stroke2_Corner0_Rounded} title={t('ui.settings.privacy.why')} />
        <Text style={[styles.body, { color: colors.secondaryText }]}>
          {t('ui.settings.privacy.whyDescription')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 28,
  },
  subsection: {
    gap: 12,
  },
  toggleGroup: {
    gap: 4,
  },
  inlineToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  inlineToggleText: {
    flex: 1,
    gap: 2,
  },
  inlineToggleTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  inlineToggleSub: {
    fontSize: 13,
    lineHeight: 17,
  },
  blockListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
});
