import { Linking, Platform } from 'react-native';
import { useCallback } from 'react';
import Constants from 'expo-constants';
import {
  SettingsGeneralPage,
  SettingsValueField,
} from '@oxy.so/bloom/settings-modal';
import { Button } from '@oxy.so/bloom/button';
import { toast } from '@oxy.so/bloom/toast';
import { useTranslation } from '@/lib/i18n';
const LINKS = {
  terms: 'https://oxy.so/terms',
  privacy: 'https://oxy.so/privacy',
  help: 'https://help.oxy.so',
  status: 'https://status.oxy.so',
};

function getAppVersion(): string {
  return Constants.expoConfig?.version ?? '1.0.0';
}

function getPlatformLabel(): string {
  if (Platform.OS === 'web') return 'Web';
  if (Platform.OS === 'ios') return 'iOS';
  if (Platform.OS === 'android') return 'Android';
  return Platform.OS;
}

export function AboutSection() {
  const { t } = useTranslation();
  const openLink = useCallback(
    async (url: string) => {
      try {
        const can = await Linking.canOpenURL(url);
        if (!can) {
          toast.error(t('ui.settings.about.linkUnavailable'));
          return;
        }
        await Linking.openURL(url);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : t('ui.settings.about.linkFailed');
        toast.error(message);
      }
    },
    [t],
  );

  return (
    <SettingsGeneralPage
      sections={[
        {
          key: 'app',
          label: 'Inbox by Oxy',
          rows: [
            {
              key: 'version',
              label: t('ui.settings.about.version', {
                version: getAppVersion(),
                platform: getPlatformLabel(),
              }),
              control: (
                <SettingsValueField>{getAppVersion()}</SettingsValueField>
              ),
            },
          ],
        },
        {
          key: 'legal',
          label: t('ui.settings.about.legal'),
          rows: (Object.keys(LINKS) as (keyof typeof LINKS)[]).map((key) => ({
            key,
            label: t(`ui.settings.about.${key}`),
            control: (
              <Button
                size="sm"
                appearance="subtle"
                onPress={() => openLink(LINKS[key])}
              >
                {t(`ui.settings.about.${key}`)}
              </Button>
            ),
          })),
        },
        {
          key: 'credits',
          description: t('ui.settings.about.madeBy', {
            year: new Date().getFullYear(),
          }),
          rows: [],
        },
      ]}
    />
  );
}
