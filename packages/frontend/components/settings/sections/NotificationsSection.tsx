import { useInboxPrefs } from '@/contexts/inbox-prefs-context';
import { useTranslation } from '@/lib/i18n';
import { Admonition } from '@oxy.so/bloom/admonition';
import {
  SettingsCard,
  SettingsRow,
  SettingsSection,
} from '@oxy.so/bloom/settings-modal';
import { Switch } from '@oxy.so/bloom/switch';
import { Platform, View } from 'react-native';
export function NotificationsSection() {
  const { prefs, setPref } = useInboxPrefs();
  const { t } = useTranslation();
  return (
    <View style={{ gap: 24 }}>
      <SettingsSection label={t('ui.settings.notifications.alerts')}>
        <SettingsCard>
          <SettingsRow
            key="pushNotifications"
            label={t('ui.settings.notifications.push')}
            description={t('ui.settings.notifications.pushDescription')}
          >
            <Switch
              accessibilityLabel={t('ui.settings.notifications.push')}
              checked={prefs.pushNotifications}
              onCheckedChange={(v) => setPref('pushNotifications', v)}
            />
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>
      <>
        {Platform.OS !== 'web' ? (
          <Admonition type="info">
            {t('ui.settings.notifications.deviceNotice')}
          </Admonition>
        ) : null}
      </>
    </View>
  );
}
