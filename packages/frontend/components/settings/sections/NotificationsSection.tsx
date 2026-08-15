/**
 * Notifications subscreen — push, digest, and sound preferences.
 *
 * Toggles persist via `useInboxPrefs` (local-device storage). Push
 * registration is wired to the "Push notifications" toggle via
 * `usePushRegistration`; digest and sound routing are still local-only.
 *
 * Layout: small icon-eyebrow subsections each with two or three visual
 * toggles — not the iOS row-spam pattern.
 */

import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Switch } from '@oxyhq/bloom/switch';
import { Text } from '@oxyhq/bloom/typography';
import { Admonition } from '@oxyhq/bloom/admonition';
import {
  Bell_Stroke2_Corner0_Rounded,
  SpeakerVolumeFull_Stroke2_Corner0_Rounded,
} from '@oxyhq/bloom/icons';

import { useColors } from '@/constants/theme';
import { useTranslation } from '@/lib/i18n';
import { SectionHeader } from '@/components/settings/SectionHeader';
import { useInboxPrefs } from '@/contexts/inbox-prefs-context';

interface InlineToggleProps {
  title: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

function InlineToggle({ title, description, value, onChange }: InlineToggleProps) {
  const colors = useColors();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={styles.inlineToggle}
    >
      <View style={styles.inlineToggleText}>
        <Text style={[styles.inlineToggleTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.inlineToggleSub, { color: colors.secondaryText }]}>
          {description}
        </Text>
      </View>
      <Switch value={value} onValueChange={onChange} />
    </Pressable>
  );
}

export function NotificationsSection() {
  const { prefs, setPref } = useInboxPrefs();
  const { t } = useTranslation();

  return (
    <View style={styles.root}>
      <View style={styles.subsection}>
        <SectionHeader icon={Bell_Stroke2_Corner0_Rounded} title={t('ui.settings.notifications.alerts')} />
        <View style={styles.toggleGroup}>
          <InlineToggle
            title={t('ui.settings.notifications.push')}
            description={t('ui.settings.notifications.pushDescription')}
            value={prefs.pushNotifications}
            onChange={(v) => setPref('pushNotifications', v)}
          />
          <InlineToggle
            title={t('ui.settings.notifications.digest')}
            description={t('ui.settings.notifications.digestDescription')}
            value={prefs.emailDigest}
            onChange={(v) => setPref('emailDigest', v)}
          />
        </View>
      </View>

      <View style={styles.subsection}>
        <SectionHeader icon={SpeakerVolumeFull_Stroke2_Corner0_Rounded} title={t('ui.settings.notifications.sound')} />
        <View style={styles.toggleGroup}>
          <InlineToggle
            title={t('ui.settings.notifications.playSound')}
            description={t('ui.settings.notifications.soundDescription')}
            value={prefs.notificationSound}
            onChange={(v) => setPref('notificationSound', v)}
          />
        </View>
      </View>

      {Platform.OS !== 'web' ? (
        <Admonition type="info">
          System-level notification permissions are managed in your device settings.
        </Admonition>
      ) : null}
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
});
