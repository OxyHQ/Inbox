import { useAccountColorSave, useOxy } from '@oxy.so/services/ui/client';
import { toast } from '@oxy.so/bloom/toast';
import { useThemeContext } from '@/contexts/theme-context';
import { useTranslation } from '@/lib/i18n';
import { SettingsGeneralPage, SettingsSelect } from '@oxy.so/bloom/settings-modal';
import { COLOR_PRESET_REGISTRY } from '@oxy.so/bloom/theme';

/** Bloom's General page with its compact settings selects. */
export function AppearanceSection() {
  const { t } = useTranslation();
  const { themePreference, setThemePreference } = useThemeContext();
  const { isAuthenticated } = useOxy();
  const { colors, value: colorValue, saveColor } = useAccountColorSave();
  const modes = (['light', 'system', 'dark'] as const).map((value) => ({
    value,
    label: t(`ui.settings.appearance.${value}`),
  }));
  // The account colour: the same one every Oxy app wears, limited to what the
  // account may wear. Signed out there is no account to save it to.
  const presets = COLOR_PRESET_REGISTRY.filter((preset) => colors.includes(preset.name));
  return (
    <SettingsGeneralPage
      sections={[
        {
          key: 'appearance',
          label: t('ui.settings.appearance.theme'),
          rows: [
            {
              key: 'mode',
              label: t('ui.settings.appearance.theme'),
              description: t('ui.settings.appearance.systemHint'),
              control: (
                <SettingsSelect
                  label={t('ui.settings.appearance.theme')}
                  value={themePreference}
                  onChange={setThemePreference}
                  items={modes}
                />
              ),
            },
            ...(isAuthenticated
              ? [
                  {
                    key: 'color',
                    label: t('ui.settings.appearance.accentColor'),
                    control: (
                      <SettingsSelect
                        label={t('ui.settings.appearance.accentColor')}
                        value={colorValue}
                        onChange={(name) => {
                          saveColor(name).catch(() => {
                            toast.error(t('ui.settings.appearance.accentColorFailed'));
                          });
                        }}
                        items={presets.map((preset) => ({
                          value: preset.name,
                          label: preset.displayName,
                        }))}
                      />
                    ),
                  },
                ]
              : []),
          ],
        },
      ]}
    />
  );
}
