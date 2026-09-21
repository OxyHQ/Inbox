import {
  SettingsGeneralPage,
  SettingsValueField,
} from '@oxy.so/bloom/settings-modal';
import { Switch } from '@oxy.so/bloom/switch';
import { useTranslation } from '@/lib/i18n';
/** These protections are enabled server-side; settings remain read-only until the API supports changes. */
export function PrivacySection() {
  const { t } = useTranslation();
  return (
    <SettingsGeneralPage
      sections={[
        {
          key: 'tracking',
          label: t('ui.settings.privacy.tracking'),
          description: t('ui.settings.privacy.info'),
          rows: ['blockImages', 'hideIp', 'stripTracking'].map((key) => ({
            key,
            label: t(`ui.settings.privacy.${key}`),
            description: t(`ui.settings.privacy.${key}Description`),
            control: (
              <Switch
                accessibilityLabel={t(`ui.settings.privacy.${key}`)}
                value
                disabled
              />
            ),
          })),
        },
        {
          key: 'trust',
          label: t('ui.settings.privacy.trust'),
          rows: [
            {
              key: 'verification',
              label: t('ui.settings.privacy.verification'),
              description: t('ui.settings.privacy.verificationDescription'),
              control: (
                <Switch
                  accessibilityLabel={t('ui.settings.privacy.verification')}
                  value
                  disabled
                />
              ),
            },
            {
              key: 'blocked',
              label: t('ui.settings.privacy.blockListTitle'),
              control: (
                <SettingsValueField muted>
                  {t('ui.settings.privacy.blockListEmpty')}
                </SettingsValueField>
              ),
            },
          ],
        },
        {
          key: 'why',
          label: t('ui.settings.privacy.why'),
          description: t('ui.settings.privacy.whyDescription'),
          rows: [],
        },
      ]}
    />
  );
}
