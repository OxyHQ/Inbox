import { GroupedSectionItem } from '@oxy.so/bloom/grouped-section';
import { useTemplates } from '@/hooks/queries/useTemplates';
import type { EmailTemplate } from '@/services/emailApi';
import { Button } from '@oxy.so/bloom/button';
import { Dialog, useDialogControl } from '@oxy.so/bloom/dialog';
import { RiDraftLine } from '@oxy.so/bloom/icons/RiDraftLine';

import { useCallback } from 'react';
import { ScrollArea } from '@oxy.so/bloom/layout';
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
        iconOnly
        onPress={() => control.open()}
        accessibilityLabel={t('templates.insert')}
        icon={<RiDraftLine />}
      />
      <Dialog control={control} title={t('templates.insert')}>
        <ScrollArea style={{ maxHeight: 360 }}>
          {templates.map((template) => (
            <GroupedSectionItem
              key={template._id}
              title={template.name}
              description={template.body.replace(/\n/g, ' ').slice(0, 60)}
              onPress={() => handleSelect(template)}
            />
          ))}
        </ScrollArea>
      </Dialog>
    </>
  );
}
