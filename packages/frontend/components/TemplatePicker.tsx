import { useTemplates } from '@/hooks/queries/useTemplates';
import type { EmailTemplate } from '@/services/emailApi';
import { IconButton } from '@oxy.so/bloom/button';
import { Dialog, useDialogControl } from '@oxy.so/bloom/dialog';
import { RiDraftLine } from '@oxy.so/bloom/icons';
import { SettingsListItem } from '@oxy.so/bloom/settings-list';
import { useCallback } from 'react';
import { ScrollView } from 'react-native';
import { useTranslation } from '@/lib/i18n';

interface TemplatePickerProps {
  onSelect: (template: EmailTemplate) => void;
}

export function TemplatePicker({ onSelect }: TemplatePickerProps) {
  const { t } = useTranslation();
  const { data: templates = [] } = useTemplates();
  const control = useDialogControl();

  const handleSelect = useCallback(
    (template: EmailTemplate) => {
      onSelect(template);
      control.close();
    },
    [onSelect, control],
  );

  if (templates.length === 0) return null;

  return (
    <>
      <IconButton
        onPress={() => control.open()}
        accessibilityLabel={t('templates.insert')}
        icon={<RiDraftLine />}
      />
      <Dialog control={control} title={t('templates.insert')}>
        <ScrollView style={{ maxHeight: 360 }}>
          {templates.map((template) => (
            <SettingsListItem
              key={template._id}
              title={template.name}
              description={template.body.replace(/\n/g, ' ').slice(0, 60)}
              onPress={() => handleSelect(template)}
            />
          ))}
        </ScrollView>
      </Dialog>
    </>
  );
}
