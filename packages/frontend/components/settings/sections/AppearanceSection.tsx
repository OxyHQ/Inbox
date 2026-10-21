import { useAccountColorSave, useOxy } from '@oxy.so/services/ui/client';
import { toast } from '@oxy.so/bloom/toast';
import { useThemeContext } from '@/contexts/theme-context';
import { useTranslation } from '@/lib/i18n';
import {
  Select,
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from '@oxy.so/bloom/select';
import { SettingsGeneralPage } from '@oxy.so/bloom/settings-modal';
import { COLOR_PRESET_REGISTRY } from '@oxy.so/bloom/theme';

/** The same General page and compact Select composition used by Bloom's settings template. */
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
                <Select
                  value={themePreference}
                  onValueChange={(value) => {
                    const mode = modes.find((item) => item.value === value);
                    if (mode) setThemePreference(mode.value);
                  }}
                >
                  <SelectTrigger
                    label={t('ui.settings.appearance.theme')}
                    className="h-8 gap-1 px-2 py-1.5"
                  >
                    <SelectValue>
                      {() => modes.find((mode) => mode.value === themePreference)?.label}
                    </SelectValue>
                    <SelectIcon />
                  </SelectTrigger>
                  <SelectContent
                    label={t('ui.settings.appearance.theme')}
                    items={modes}
                    valueExtractor={(item) => item.value}
                    renderItem={(item) => (
                      <SelectItem value={item.value} label={item.label}>
                        <SelectItemIndicator />
                        <SelectItemText>{item.label}</SelectItemText>
                      </SelectItem>
                    )}
                  />
                </Select>
              ),
            },
            ...(isAuthenticated
              ? [
                  {
                    key: 'color',
                    label: t('ui.settings.appearance.accentColor'),
                    control: (
                      <Select
                        value={colorValue}
                        onValueChange={(value) => {
                          const preset = presets.find((item) => item.name === value);
                          if (!preset) return;
                          saveColor(preset.name).catch(() => {
                            toast.error(t('ui.settings.appearance.accentColorFailed'));
                          });
                        }}
                      >
                        <SelectTrigger
                          label={t('ui.settings.appearance.accentColor')}
                          className="h-8 gap-1 px-2 py-1.5"
                        >
                          <SelectValue>
                            {() =>
                              COLOR_PRESET_REGISTRY.find((preset) => preset.name === colorValue)
                                ?.displayName
                            }
                          </SelectValue>
                          <SelectIcon />
                        </SelectTrigger>
                        <SelectContent
                          label={t('ui.settings.appearance.accentColor')}
                          items={presets}
                          valueExtractor={(item) => item.name}
                          renderItem={(item) => (
                            <SelectItem value={item.name} label={item.displayName}>
                              <SelectItemIndicator />
                              <SelectItemText>{item.displayName}</SelectItemText>
                            </SelectItem>
                          )}
                        />
                      </Select>
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
