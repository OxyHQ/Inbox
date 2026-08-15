/**
 * AI features subscreen — opt-in toggles for AI conveniences.
 *
 * Persists via `useInboxPrefs` (local-device). The features that surface these
 * flags consume them directly and skip their work when disabled: `HomeScreen`
 * gates the daily brief (and disables `useDailyBrief`), `SmartReplyChips`
 * renders nothing when Smart Reply is off, and `ImportanceBadge` hides itself
 * when categorization is off.
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Switch } from '@oxyhq/bloom/switch';
import { Text } from '@oxyhq/bloom/typography';
import { Admonition } from '@oxyhq/bloom/admonition';
import {
  Sparkle_Stroke2_Corner0_Rounded,
  Bot_Stroke,
  Reply,
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

export function AISection() {
  const { t } = useTranslation();
  const { prefs, setPref } = useInboxPrefs();

  return (
    <View style={styles.root}>
      <View style={styles.subsection}>
        <SectionHeader icon={Sparkle_Stroke2_Corner0_Rounded} title={t('ui.settings.ai.dailyBrief')} />
        <View style={styles.toggleGroup}>
          <InlineToggle
            title={t('ui.settings.ai.recap')}
            description={t('ui.settings.ai.recapDescription')}
            value={prefs.aiBrief}
            onChange={(v) => setPref('aiBrief', v)}
          />
        </View>
      </View>

      <View style={styles.subsection}>
        <SectionHeader icon={Reply} title={t('ui.settings.ai.smartReply')} />
        <View style={styles.toggleGroup}>
          <InlineToggle
            title={t('ui.settings.ai.suggestions')}
            description={t('ui.settings.ai.suggestionsDescription')}
            value={prefs.aiSmartReply}
            onChange={(v) => setPref('aiSmartReply', v)}
          />
        </View>
      </View>

      <View style={styles.subsection}>
        <SectionHeader icon={Bot_Stroke} title={t('ui.settings.ai.priority')} />
        <View style={styles.toggleGroup}>
          <InlineToggle
            title={t('ui.settings.ai.priorityTitle')}
            description={t('ui.settings.ai.priorityDescription')}
            value={prefs.aiCategorization}
            onChange={(v) => setPref('aiCategorization', v)}
          />
        </View>
      </View>

      <Admonition type="tip">
        {t('ui.settings.ai.tip')}
      </Admonition>
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
