import { SettingsGeneralPage } from '@oxy.so/bloom/settings-modal';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectIcon,
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
} from '@oxy.so/bloom/select';
import { COLOR_PRESET_REGISTRY, FREE_COLOR_NAMES } from '@oxy.so/bloom/theme';
import { useThemeContext } from '@/contexts/theme-context';
import { useTranslation } from '@/lib/i18n';

/** The same General page and compact Select composition used by Bloom's settings template. */
export function AppearanceSection() {
  const { t } = useTranslation();
  const { themePreference, setThemePreference, colorPreset, setColorPreset } =
    useThemeContext();
  const modes = (['light', 'system', 'dark'] as const).map((value) => ({
    value,
    label: t(`ui.settings.appearance.${value}`),
  }));
  const presets = COLOR_PRESET_REGISTRY.filter((preset) =>
    FREE_COLOR_NAMES.includes(preset.name),
  );
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
                      {() =>
                        modes.find((mode) => mode.value === themePreference)
                          ?.label
                      }
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
            {
              key: 'color',
              label: t('ui.settings.appearance.accentColor'),
              control: (
                <Select
                  value={colorPreset}
                  onValueChange={(value) => {
                    const preset = presets.find((item) => item.name === value);
                    if (preset) setColorPreset(preset.name);
                  }}
                >
                  <SelectTrigger
                    label={t('ui.settings.appearance.accentColor')}
                    className="h-8 gap-1 px-2 py-1.5"
                  >
                    <SelectValue>
                      {() =>
                        COLOR_PRESET_REGISTRY.find(
                          (preset) => preset.name === colorPreset,
                        )?.displayName
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
          ],
        },
      ]}
    />
  );
}
