import { useContactSuggestions } from '@/hooks/queries/useContactSuggestions';
import { useTranslation } from '@/lib/i18n';
import { isValidRecipientEmail } from '@/schemas/emailSchemas';
import { Button } from '@oxy.so/bloom/button';
import {
  MailRecipientField,
  type MailRecipient,
} from '@oxy.so/bloom/mail-compose';
import { TextFieldInput } from '@oxy.so/bloom/text-field';
import { useState } from 'react';
import { View } from 'react-native';

/** Retain the unfinished address in the draft on every keystroke, including send/blur. */
export function splitRecipientInput(value: string) {
  const parts = value.split(',');
  const query = parts.pop() ?? '';
  const recipients: MailRecipient[] = parts
    .map((address) => address.trim())
    .filter(Boolean)
    .map((address, index) => ({
      id: `${index}:${address}`,
      address,
      invalid: !isValidRecipientEmail(address),
    }));
  return { recipients, query };
}
function RecipientField({
  label,
  value,
  onChange,
  trailing,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  trailing?: React.ReactNode;
}) {
  const { recipients, query } = splitRecipientInput(value);
  const { data: suggestions = [] } = useContactSuggestions(query.trim());
  const join = (items: readonly MailRecipient[], next: string) =>
    onChange(
      [...items.map((item) => item.address), next.trimStart()].join(', '),
    );
  return (
    <MailRecipientField
      label={label}
      recipients={recipients}
      value={query.trimStart()}
      onRecipientsChange={(next) => join(next, query)}
      onChangeText={(next) => join(recipients, next)}
      onSubmit={(next) =>
        join([...recipients, { id: next, address: next.trim() }], '')
      }
      suggestions={suggestions.map((item) => ({
        id: item.address,
        address: item.address,
        name: item.name ?? undefined,
      }))}
      onSuggestionPress={(item) =>
        join([...recipients, { id: item.id, address: item.address }], '')
      }
      trailing={trailing}
    />
  );
}
interface MailAddressFieldsProps {
  to: string;
  onToChange: (value: string) => void;
  cc: string;
  onCcChange: (value: string) => void;
  bcc: string;
  onBccChange: (value: string) => void;
  subject?: string;
  onSubjectChange?: (value: string) => void;
}
/** The three controlled fields share draft state, never an unfinished query. */
export function MailAddressFields(props: MailAddressFieldsProps) {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  const copies = revealed || !!props.cc || !!props.bcc;
  return (
    <View>
      <RecipientField
        label={t('compose.fields.to')}
        value={props.to}
        onChange={props.onToChange}
        trailing={
          !copies ? (
            <Button
              size="xs"
              variant="link"
              onPress={() => setRevealed(true)}
            >{`${t('compose.fields.cc')} / ${t('compose.fields.bcc')}`}</Button>
          ) : undefined
        }
      />
      {copies && (
        <>
          <RecipientField
            label={t('compose.fields.cc')}
            value={props.cc}
            onChange={props.onCcChange}
          />
          <RecipientField
            label={t('compose.fields.bcc')}
            value={props.bcc}
            onChange={props.onBccChange}
          />
        </>
      )}
      {props.onSubjectChange && (
        <View className="px-4 py-2">
          <TextFieldInput
            label={t('compose.placeholders.subject')}
            value={props.subject}
            onChangeText={props.onSubjectChange}
          />
        </View>
      )}
    </View>
  );
}
