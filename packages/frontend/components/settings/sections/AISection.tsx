import { GroupedSection, GroupedSectionItem } from '@oxy.so/bloom/grouped-section';
import { useInboxPrefs } from '@/contexts/inbox-prefs-context';
import { useTranslation } from '@/lib/i18n';
import { Admonition } from '@oxy.so/bloom/admonition';
import { SettingsSection } from '@oxy.so/bloom/settings-modal';
import { Switch } from '@oxy.so/bloom/switch';
import { View } from 'react-native';
export function AISection() {
  const { prefs, setPref } = useInboxPrefs();
  const { t } = useTranslation();
  return (
    <View style={{ gap: 24 }}>
      <SettingsSection label={t('ui.settings.ai.dailyBrief')}>
        <GroupedSection>
          <GroupedSectionItem
            wrapControl
            key="aiBrief"
            title={t('ui.settings.ai.recap')}
            description={t('ui.settings.ai.recapDescription')}
            rightElement={
              <Switch
                accessibilityLabel={t('ui.settings.ai.recap')}
                checked={prefs.aiBrief}
                onCheckedChange={(v) => setPref('aiBrief', v)}
              />
            }
          />
        </GroupedSection>
      </SettingsSection>
      <SettingsSection label={t('ui.settings.ai.smartReply')}>
        <GroupedSection>
          <GroupedSectionItem
            wrapControl
            key="aiSmartReply"
            title={t('ui.settings.ai.suggestions')}
            description={t('ui.settings.ai.suggestionsDescription')}
            rightElement={
              <Switch
                accessibilityLabel={t('ui.settings.ai.suggestions')}
                checked={prefs.aiSmartReply}
                onCheckedChange={(v) => setPref('aiSmartReply', v)}
              />
            }
          />
        </GroupedSection>
      </SettingsSection>
      <SettingsSection label={t('ui.settings.ai.summary')}>
        <GroupedSection>
          <GroupedSectionItem
            wrapControl
            key="aiThreadSummary"
            title={t('ui.settings.ai.summaryTitle')}
            description={t('ui.settings.ai.summaryDescription')}
            rightElement={
              <Switch
                accessibilityLabel={t('ui.settings.ai.summaryTitle')}
                checked={prefs.aiThreadSummary}
                onCheckedChange={(v) => setPref('aiThreadSummary', v)}
              />
            }
          />
        </GroupedSection>
      </SettingsSection>
      <SettingsSection label={t('ui.settings.ai.priority')}>
        <GroupedSection>
          <GroupedSectionItem
            wrapControl
            key="aiCategorization"
            title={t('ui.settings.ai.priorityTitle')}
            description={t('ui.settings.ai.priorityDescription')}
            rightElement={
              <Switch
                accessibilityLabel={t('ui.settings.ai.priorityTitle')}
                checked={prefs.aiCategorization}
                onCheckedChange={(v) => setPref('aiCategorization', v)}
              />
            }
          />
        </GroupedSection>
      </SettingsSection>
      <Admonition type="tip">{t('ui.settings.ai.tip')}</Admonition>
    </View>
  );
}
