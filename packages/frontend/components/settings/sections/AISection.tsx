import { useInboxPrefs } from '@/contexts/inbox-prefs-context';
import { useTranslation } from '@/lib/i18n';
import { Admonition } from '@oxy.so/bloom/admonition';
import { GroupedSection, GroupedSectionItem } from '@oxy.so/bloom/grouped-section';
import { Switch } from '@oxy.so/bloom/switch';
import { View } from 'react-native';
export function AISection() {
  const { prefs, setPref } = useInboxPrefs();
  const { t } = useTranslation();
  return (
    <View style={{ gap: 24 }}>
      <GroupedSection title={t('ui.settings.ai.dailyBrief')}>
        <GroupedSectionItem
          titleNumberOfLines={0}
          descriptionLines={0}
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
      <GroupedSection title={t('ui.settings.ai.smartReply')}>
        <GroupedSectionItem
          titleNumberOfLines={0}
          descriptionLines={0}
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
      <GroupedSection title={t('ui.settings.ai.summary')}>
        <GroupedSectionItem
          titleNumberOfLines={0}
          descriptionLines={0}
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
      <GroupedSection title={t('ui.settings.ai.priority')}>
        <GroupedSectionItem
          titleNumberOfLines={0}
          descriptionLines={0}
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
      <Admonition type="tip">{t('ui.settings.ai.tip')}</Admonition>
    </View>
  );
}
