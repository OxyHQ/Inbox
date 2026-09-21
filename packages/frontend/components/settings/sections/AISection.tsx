import { View } from 'react-native';
import { Switch } from '@oxy.so/bloom/switch';
import {
  SettingsCard,
  SettingsRow,
  SettingsSection,
} from '@oxy.so/bloom/settings-modal';
import { Admonition } from '@oxy.so/bloom/admonition';
import { useInboxPrefs } from '@/contexts/inbox-prefs-context';
import { useTranslation } from '@/lib/i18n';
export function AISection() {
  const { prefs, setPref } = useInboxPrefs();
  const { t } = useTranslation();
  return (
    <View style={{ gap: 24 }}>
      <SettingsSection label={t('ui.settings.ai.dailyBrief')}>
        <SettingsCard>
          <SettingsRow
            key="aiBrief"
            label={t('ui.settings.ai.recap')}
            description={t('ui.settings.ai.recapDescription')}
          >
            <Switch
              accessibilityLabel={t('ui.settings.ai.recap')}
              value={prefs.aiBrief}
              onValueChange={(v) => setPref('aiBrief', v)}
            />
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>
      <SettingsSection label={t('ui.settings.ai.smartReply')}>
        <SettingsCard>
          <SettingsRow
            key="aiSmartReply"
            label={t('ui.settings.ai.suggestions')}
            description={t('ui.settings.ai.suggestionsDescription')}
          >
            <Switch
              accessibilityLabel={t('ui.settings.ai.suggestions')}
              value={prefs.aiSmartReply}
              onValueChange={(v) => setPref('aiSmartReply', v)}
            />
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>
      <SettingsSection label={t('ui.settings.ai.priority')}>
        <SettingsCard>
          <SettingsRow
            key="aiCategorization"
            label={t('ui.settings.ai.priorityTitle')}
            description={t('ui.settings.ai.priorityDescription')}
          >
            <Switch
              accessibilityLabel={t('ui.settings.ai.priorityTitle')}
              value={prefs.aiCategorization}
              onValueChange={(v) => setPref('aiCategorization', v)}
            />
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>
      <Admonition type="tip">{t('ui.settings.ai.tip')}</Admonition>
    </View>
  );
}
