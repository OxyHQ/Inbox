import { useInboxPrefs } from '@/contexts/inbox-prefs-context';
import { useTranslation } from '@/lib/i18n';
import { Text, toElement, VStack } from '@oxy.so/bloom-language';
import { Admonition, GroupedSection, GroupedSectionItem } from '@oxy.so/bloom-language/containers';
import { Toggle } from '@oxy.so/bloom-language/inputs';
import { Platform } from 'react-native';

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
    return toElement(
      VStack(Admonition(Text(t('ui.settings.notifications.webNotice'))).style('info')).spacing(
        '2xl',
      ),
    );
  }

  const push = t('ui.settings.notifications.push');
  return toElement(
    VStack(
      GroupedSection(
        GroupedSectionItem(push)
          .lines(0)
          .descriptionLines(0)
          .wrapControl()
          .description(t('ui.settings.notifications.pushDescription'))
          .trailing(
            Toggle([
              prefs.pushNotifications,
              (v: boolean) => setPref('pushNotifications', v),
            ]).label(push),
          ),
      ).title(t('ui.settings.notifications.alerts')),
      Admonition(Text(t('ui.settings.notifications.deviceNotice'))).style('info'),
    ).spacing('2xl'),
  );
}
