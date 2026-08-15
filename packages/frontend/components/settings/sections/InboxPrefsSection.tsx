/**
 * Inbox preferences subscreen — list, reading, and swipe controls.
 *
 * Layout follows the Alia subsection pattern (small eyebrow header + visual
 * content block) rather than the iOS row-spam look. Toggles persist via
 * `useInboxPrefs` (local device) and are consumed live: `MessageRow` reads
 * density/avatars/previews through `useInboxDisplayPrefs`, `InboxList` reads
 * `conversationView` (thread grouping) and `markReadOnOpen`, and `SwipeableRow`
 * reads the left/right swipe bindings.
 */

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Switch } from '@oxyhq/bloom/switch';
import { SegmentedControl, SegmentedControlItem, SegmentedControlItemText } from '@oxyhq/bloom/segmented-control';
import { Text } from '@oxyhq/bloom/typography';
import { useTheme } from '@oxyhq/bloom/theme';
import {
  Envelope_Stroke2_Corner0_Rounded,
  Eye_Stroke2_Corner0_Rounded,
  ArrowBoxLeft_Stroke2_Corner0_Rounded,
} from '@oxyhq/bloom/icons';

import { useColors } from '@/constants/theme';
import { useTranslation } from '@/lib/i18n';
import { SectionHeader } from '@/components/settings/SectionHeader';
import {
  useInboxPrefs,
  type MessageDensity,
  type SwipeAction,
} from '@/contexts/inbox-prefs-context';

const DENSITY_OPTIONS: readonly { value: MessageDensity; labelKey: string }[] = [
  { value: 'compact', labelKey: 'ui.settings.inbox.compact' },
  { value: 'comfortable', labelKey: 'ui.settings.inbox.comfortable' },
  { value: 'cozy', labelKey: 'ui.settings.inbox.cozy' },
];

const SWIPE_OPTIONS: readonly { value: SwipeAction; labelKey: string }[] = [
  { value: 'archive', labelKey: 'message.actions.archive' },
  { value: 'delete', labelKey: 'message.actions.delete' },
  { value: 'mark-read', labelKey: 'message.actions.markRead' },
  { value: 'snooze', labelKey: 'message.actions.snooze' },
  { value: 'none', labelKey: 'common.no' },
];

function swipeLabel(action: SwipeAction, translate: (key: string) => string): string {
  const option = SWIPE_OPTIONS.find((o) => o.value === action);
  return option ? translate(option.labelKey) : action;
}

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

interface SwipePickerProps {
  label: string;
  value: SwipeAction;
  onChange: (value: SwipeAction) => void;
  translate: (key: string) => string;
}

function SwipePicker({ label, value, onChange, translate }: SwipePickerProps) {
  const colors = useColors();
  const theme = useTheme();
  const handlePress = useCallback(() => {
    const idx = SWIPE_OPTIONS.findIndex((o) => o.value === value);
    const next = SWIPE_OPTIONS[(idx + 1) % SWIPE_OPTIONS.length];
    onChange(next.value);
  }, [value, onChange]);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
    accessibilityLabel={translate('ui.settings.inbox.swipeA11y')
      .replace('{{label}}', label)
      .replace('{{value}}', swipeLabel(value, translate))}
      style={[styles.swipeRow, { borderColor: colors.border }]}
    >
      <Text style={[styles.swipeLabel, { color: colors.text }]}>{label}</Text>
      <View style={[styles.swipeBadge, { backgroundColor: theme.colors.primarySubtle }]}>
        <Text style={[styles.swipeValue, { color: theme.colors.primarySubtleForeground }]}>
          {swipeLabel(value, translate)}
        </Text>
      </View>
    </Pressable>
  );
}

export function InboxPrefsSection() {
  const colors = useColors();
  const { t } = useTranslation();
  const { prefs, setPref } = useInboxPrefs();

  const handleDensityChange = useCallback(
    (value: MessageDensity) => setPref('density', value),
    [setPref],
  );

  return (
    <View style={styles.root}>
      {/* Density */}
      <View style={styles.subsection}>
        <SectionHeader icon={Envelope_Stroke2_Corner0_Rounded} title={t('ui.settings.inbox.density')} />
        <SegmentedControl<MessageDensity>
          label={t('ui.settings.inbox.density')}
          type="radio"
          value={prefs.density}
          onChange={handleDensityChange}
        >
          {DENSITY_OPTIONS.map((opt) => (
            <SegmentedControlItem key={opt.value} value={opt.value}>
              <SegmentedControlItemText>{t(opt.labelKey)}</SegmentedControlItemText>
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
        <Text style={[styles.footnote, { color: colors.secondaryText }]}>
          {t('ui.settings.inbox.densityHint')}
        </Text>
      </View>

      {/* Display options */}
      <View style={styles.subsection}>
        <SectionHeader icon={Eye_Stroke2_Corner0_Rounded} title={t('ui.settings.inbox.display')} />
        <View style={styles.toggleGroup}>
          <InlineToggle
            title={t('ui.settings.inbox.avatars')}
            description={t('ui.settings.inbox.avatarsDescription')}
            value={prefs.showAvatars}
            onChange={(v) => setPref('showAvatars', v)}
          />
          <InlineToggle
            title={t('ui.settings.inbox.previews')}
            description={t('ui.settings.inbox.previewsDescription')}
            value={prefs.showPreviews}
            onChange={(v) => setPref('showPreviews', v)}
          />
          <InlineToggle
            title={t('ui.settings.inbox.threads')}
            description={t('ui.settings.inbox.threadsDescription')}
            value={prefs.conversationView}
            onChange={(v) => setPref('conversationView', v)}
          />
          <InlineToggle
            title={t('ui.settings.inbox.markRead')}
            description={t('ui.settings.inbox.markReadDescription')}
            value={prefs.markReadOnOpen}
            onChange={(v) => setPref('markReadOnOpen', v)}
          />
        </View>
      </View>

      {/* Swipe actions */}
      <View style={styles.subsection}>
        <SectionHeader icon={ArrowBoxLeft_Stroke2_Corner0_Rounded} title={t('ui.settings.inbox.swipeActions')} />
        <View style={styles.swipeStack}>
          <SwipePicker
            label={t('ui.settings.inbox.swipeRight')}
            value={prefs.leftSwipeAction}
            onChange={(v) => setPref('leftSwipeAction', v)}
            translate={t}
          />
          <SwipePicker
            label={t('ui.settings.inbox.swipeLeft')}
            value={prefs.rightSwipeAction}
            onChange={(v) => setPref('rightSwipeAction', v)}
            translate={t}
          />
        </View>
        <Text style={[styles.footnote, { color: colors.secondaryText }]}>
          {t('ui.settings.inbox.swipeHint')}
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
  swipeStack: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    overflow: 'hidden',
  },
  swipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  swipeLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  swipeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  swipeValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  footnote: {
    fontSize: 12,
    paddingHorizontal: 2,
  },
});
