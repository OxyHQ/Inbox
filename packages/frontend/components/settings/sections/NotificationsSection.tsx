import { Platform, View } from 'react-native';
import { Switch } from '@oxy.so/bloom/switch';
import {
  SettingsCard,
  SettingsRow,
  SettingsSection,
} from '@oxy.so/bloom/settings-modal';
import { Admonition } from '@oxy.so/bloom/admonition';
import { useInboxPrefs } from '@/contexts/inbox-prefs-context';
import { useTranslation } from '@/lib/i18n';
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
              value={prefs.pushNotifications}
              onValueChange={(v) => setPref('pushNotifications', v)}
            />
          </SettingsRow>
          <SettingsRow
            key="emailDigest"
            label={t('ui.settings.notifications.digest')}
            description={t('ui.settings.notifications.digestDescription')}
          >
            <Switch
              accessibilityLabel={t('ui.settings.notifications.digest')}
              value={prefs.emailDigest}
              onValueChange={(v) => setPref('emailDigest', v)}
            />
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>
      <SettingsSection label={t('ui.settings.notifications.sound')}>
        <SettingsCard>
          <SettingsRow
            key="notificationSound"
            label={t('ui.settings.notifications.playSound')}
            description={t('ui.settings.notifications.soundDescription')}
          >
            <Switch
              accessibilityLabel={t('ui.settings.notifications.playSound')}
              value={prefs.notificationSound}
              onValueChange={(v) => setPref('notificationSound', v)}
            />
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>
      <>
        {Platform.OS !== 'web' ? (
          <Admonition type="info">
            System-level notification permissions are managed in your device
            settings.
          </Admonition>
        ) : null}
      </>
    </View>
  );
}
