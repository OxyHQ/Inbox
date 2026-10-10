import { useTranslation } from '@/lib/i18n';
import {
  SettingsGeneralPage,
  SettingsValueField,
} from '@oxy.so/bloom/settings-modal';

/**
 * What the reader actually gets, and nothing it does not.
 *
 * This page used to list "Block remote images (until you tap to allow)",
 * "Strip tracking parameters", "Sender verification" and an always-empty block
 * list as switched-on protections. None of them existed. What does: every
 * remote image and font in a message is rewritten to the API's `/email/proxy`
 * (`utils/htmlTransform.ts`), which fetches it on the reader's behalf — so the
 * sender's server sees Oxy, not the reader's IP or location — and answers a
 * known tracking URL with a blank image instead. Neither can be turned off,
 * so each row states it rather than offering a switch.
 */
export function PrivacySection() {
  const { t } = useTranslation();
  const alwaysOn = (
    <SettingsValueField muted>{t('ui.settings.privacy.alwaysOn')}</SettingsValueField>
  );
  return (
    <SettingsGeneralPage
      sections={[
        {
          key: 'images',
          label: t('ui.settings.privacy.images'),
          description: t('ui.settings.privacy.info'),
          rows: [
            {
              key: 'proxy',
              label: t('ui.settings.privacy.proxy'),
              description: t('ui.settings.privacy.proxyDescription'),
              control: alwaysOn,
            },
            {
              key: 'trackers',
              label: t('ui.settings.privacy.trackers'),
              description: t('ui.settings.privacy.trackersDescription'),
              control: alwaysOn,
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
