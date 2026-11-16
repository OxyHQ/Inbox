import { useTemplates } from '@/hooks/queries/useTemplates';
import type { EmailTemplate } from '@/services/emailApi';
import { Button } from '@oxy.so/bloom/button';
import { Dialog, useDialogControl } from '@oxy.so/bloom/dialog';
import { RiDraftLine } from '@oxy.so/bloom/icons/RiDraftLine';
import { List } from '@oxy.so/bloom/list';
import { useCallback } from 'react';
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
      <Button
        appearance="outline"
        tone="neutral"
        onPress={() => control.open()}
        accessibilityLabel={t('templates.insert')}
        icon={<RiDraftLine />}
      />
      <Dialog control={control} title={t('templates.insert')}>
        <List
          items={templates.map((template) => ({
            id: template._id,
            title: template.name,
            supporting: template.body.replace(/\n/g, ' '),
            supportingLines: 2,
            onPress: () => handleSelect(template),
          }))}
        />
      </Dialog>
    </>
  );
}
