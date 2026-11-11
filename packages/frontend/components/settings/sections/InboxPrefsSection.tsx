import { KeyboardShortcutsHelp } from '@/components/KeyboardShortcutsHelp';
import {
  UNDO_SEND_SECONDS,
  useInboxPrefs,
  type MessageDensity,
  type SwipeAction,
} from '@/contexts/inbox-prefs-context';
import { useDeleteSavedSearch } from '@/hooks/mutations/useSavedSearchMutations';
import { useSavedSearches } from '@/hooks/queries/useSavedSearches';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@oxy.so/bloom/button';
import { useDialogControl } from '@oxy.so/bloom/dialog';
import { SettingsGeneralPage, SettingsSelect } from '@oxy.so/bloom/settings-modal';
import { Switch } from '@oxy.so/bloom/switch';
import { Platform } from 'react-native';
const DENSITY_OPTIONS: readonly { value: MessageDensity; labelKey: string }[] = [
  { value: 'compact', labelKey: 'ui.settings.inbox.compact' },
  { value: 'comfortable', labelKey: 'ui.settings.inbox.comfortable' },
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
  const { data: savedSearches = [] } = useSavedSearches();
  const deleteSavedSearch = useDeleteSavedSearch();
  const shortcutsControl = useDialogControl();
  const toggles = [
    ['showPreviews', 'previews'],
    ['conversationView', 'threads'],
    ['markReadOnOpen', 'markRead'],
  ] as const;
  return (
    <>
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
                  <SettingsSelect
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
                  checked={prefs[key]}
                  onCheckedChange={(v) => setPref(key, v)}
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
                <SettingsSelect
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
          {
            key: 'sending',
            label: t('ui.settings.inbox.sending'),
            rows: [
              {
                key: 'undoSend',
                label: t('ui.settings.inbox.undoSend'),
                description: t('ui.settings.inbox.undoSendDescription'),
                control: (
                  <SettingsSelect
                    label={t('ui.settings.inbox.undoSend')}
                    value={String(prefs.undoSendSeconds)}
                    onChange={(v) =>
                      setPref('undoSendSeconds', Number(v) as typeof prefs.undoSendSeconds)
                    }
                    items={UNDO_SEND_SECONDS.map((seconds) => ({
                      value: String(seconds),
                      label:
                        seconds === 0
                          ? t('common.no')
                          : t('ui.settings.inbox.undoSendSeconds', { count: seconds }),
                    }))}
                  />
                ),
              },
            ],
          },
          {
            key: 'savedSearches',
            label: t('ui.settings.inbox.savedSearches'),
            description: savedSearches.length
              ? undefined
              : t('ui.settings.inbox.savedSearchesEmpty'),
            rows: savedSearches.map((search) => ({
              key: search.id,
              label: search.name,
              description: search.query || undefined,
              control: (
                <Button
                  appearance="subtle"
                  tone="danger"
                  disabled={deleteSavedSearch.isPending}
                  onPress={() => deleteSavedSearch.mutate(search.id)}
                >
                  {t('common.delete')}
                </Button>
              ),
            })),
          },
          ...(Platform.OS === 'web'
            ? [
                {
                  key: 'shortcuts',
                  label: t('ui.settings.inbox.shortcuts'),
                  rows: [
                    {
                      key: 'shortcuts',
                      label: t('ui.settings.inbox.shortcuts'),
                      description: t('ui.settings.inbox.shortcutsDescription'),
                      control: (
                        <Button appearance="subtle" onPress={() => shortcutsControl.open()}>
                          {t('ui.settings.inbox.shortcutsOpen')}
                        </Button>
                      ),
                    },
                  ],
                },
              ]
            : []),
        ]}
      />
      <KeyboardShortcutsHelp control={shortcutsControl} />
    </>
  );
}
