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

/**
 * Push is native-only: the browser has no push subscription wired (no VAPID
 * key, no `pushManager.subscribe`), and `usePushRegistration` skips the web.
 * The switch used to show there anyway and saved a preference nothing read, so
 * the web gets an explanation instead of a control that does nothing.
 */
export function NotificationsSection() {
  const { prefs, setPref } = useInboxPrefs();
  const { t } = useTranslation();

  if (Platform.OS === 'web') {
    return (
      <View style={{ gap: 24 }}>
        <Admonition type="info">
          {t('ui.settings.notifications.webNotice')}
        </Admonition>
      </View>
    );
  }

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
      <Admonition type="info">
        {t('ui.settings.notifications.deviceNotice')}
      </Admonition>
    </View>
  );
}
