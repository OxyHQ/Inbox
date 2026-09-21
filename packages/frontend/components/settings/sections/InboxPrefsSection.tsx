import { SettingsGeneralPage } from '@oxy.so/bloom/settings-modal';
import { Switch } from '@oxy.so/bloom/switch';
import { SettingsPreferenceSelect } from '../SettingsPreferenceSelect';
import {
  useInboxPrefs,
  type MessageDensity,
  type SwipeAction,
} from '@/contexts/inbox-prefs-context';
import { useTranslation } from '@/lib/i18n';
const DENSITY_OPTIONS: readonly { value: MessageDensity; labelKey: string }[] =
  [
    { value: 'compact', labelKey: 'ui.settings.inbox.compact' },
    { value: 'comfortable', labelKey: 'ui.settings.inbox.comfortable' },
    { value: 'cozy', labelKey: 'ui.settings.inbox.cozy' },
  ];

const SWIPE_OPTIONS: readonly { value: SwipeAction; labelKey: string }[] = [
  { value: 'archive', labelKey: 'message.actions.archive' },
  { value: 'delete', labelKey: 'message.actions.delete' },
  { value: 'mark-read', labelKey: 'message.actions.markRead' },
  { value: 'snooze', labelKey: 'message.actions.snooze' },
  { value: 'none', labelKey: 'common.no' },
];

export function InboxPrefsSection() {
  const { t } = useTranslation();
  const { prefs, setPref } = useInboxPrefs();
  const toggles = [
    ['showAvatars', 'avatars'],
    ['showPreviews', 'previews'],
    ['conversationView', 'threads'],
    ['markReadOnOpen', 'markRead'],
  ] as const;
  return (
    <SettingsGeneralPage
      sections={[
        {
          key: 'density',
          rows: [
            {
              key: 'density',
              label: t('ui.settings.inbox.density'),
              description: t('ui.settings.inbox.densityHint'),
              control: (
                <SettingsPreferenceSelect
                  label={t('ui.settings.inbox.density')}
                  value={prefs.density}
                  onChange={(v) => setPref('density', v)}
                  items={DENSITY_OPTIONS.map((item) => ({
                    value: item.value,
                    label: t(item.labelKey),
                  }))}
                />
              ),
            },
          ],
        },
        {
          key: 'display',
          label: t('ui.settings.inbox.display'),
          rows: toggles.map(([key, label]) => ({
            key,
            label: t(`ui.settings.inbox.${label}`),
            description: t(`ui.settings.inbox.${label}Description`),
            control: (
              <Switch
                accessibilityLabel={t(`ui.settings.inbox.${label}`)}
                value={prefs[key]}
                onValueChange={(v) => setPref(key, v)}
              />
            ),
          })),
        },
        {
          key: 'swipe',
          label: t('ui.settings.inbox.swipeActions'),
          description: t('ui.settings.inbox.swipeHint'),
          rows: (
            [
              ['leftSwipeAction', 'swipeRight'],
              ['rightSwipeAction', 'swipeLeft'],
            ] as const
          ).map(([key, label]) => ({
            key,
            label: t(`ui.settings.inbox.${label}`),
            control: (
              <SettingsPreferenceSelect
                label={t(`ui.settings.inbox.${label}`)}
                value={prefs[key]}
                onChange={(v) => setPref(key, v)}
                items={SWIPE_OPTIONS.map((item) => ({
                  value: item.value,
                  label: t(item.labelKey),
                }))}
              />
            ),
          })),
        },
      ]}
    />
  );
}
