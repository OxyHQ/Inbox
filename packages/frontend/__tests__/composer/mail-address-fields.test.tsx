import { MailAddressFields } from '@/components/MailAddressFields';
import { fireEvent, render, screen } from '@testing-library/react';
import { type ReactNode, useState } from 'react';
import { defined } from '../fixtures/defined';
import type { Children, Pressable } from '../fixtures/mockProps';

/** A recipient chip as Bloom's MailRecipientField takes it. */
interface MockRecipient {
  id: string;
  address: string;
}

jest.mock('react-native', () => ({
  View: ({ children }: Children) => <div>{children}</div>,
}));
jest.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/hooks/queries/useContactSuggestions', () => ({
  useContactSuggestions: () => ({
    data: [{ address: 'suggested@example.com' }],
  }),
}));
jest.mock('@oxy.so/bloom/mail-compose', () => ({
  MailRecipientField: ({
    label,
    value,
    onChangeText,
    onSubmit,
    recipients,
    onRecipientsChange,
    onSuggestionPress,
    trailing,
  }: {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    onSubmit: (text: string) => void;
    recipients: MockRecipient[];
    onRecipientsChange: (recipients: MockRecipient[]) => void;
    onSuggestionPress: (recipient: MockRecipient) => void;
    trailing?: ReactNode;
  }) => (
    <section>
      <input
        aria-label={label}
        value={value}
        onChange={(event) => onChangeText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onSubmit(value);
        }}
      />
      {recipients.map((item) => (
        <button
          type="button"
          key={item.id}
          onClick={() => onRecipientsChange(recipients.filter((other) => other.id !== item.id))}
        >
          {item.address}
        </button>
      ))}
      <button
        type="button"
        onClick={() =>
          onSuggestionPress({
            id: 'suggestion',
            address: 'suggested@example.com',
          })
        }
      >
        {label} suggestion
      </button>
      {trailing}
    </section>
  ),
}));
jest.mock('@oxy.so/bloom/button', () => ({
  Button: ({ children, onPress }: Pressable) => (
    <button type="button" onClick={onPress}>
      {children}
    </button>
  ),
}));
jest.mock('@oxy.so/bloom/text-field', () => ({ TextFieldInput: () => null }));
function Fixture() {
  const [to, setTo] = useState('first@example.com, ');
  const [cc, setCc] = useState('copy@example.com');
  const [bcc, setBcc] = useState('');
  return (
    <>
      <MailAddressFields
        to={to}
        onToChange={setTo}
        cc={cc}
        onCcChange={setCc}
        bcc={bcc}
        onBccChange={setBcc}
      />
      <output>{JSON.stringify({ to, cc, bcc })}</output>
    </>
  );
}
function draft() {
  return JSON.parse(defined(screen.getByRole('status').textContent));
}
it('retains unfinished addresses in the persisted draft without Enter, separately for each field', () => {
  render(<Fixture />);
  fireEvent.change(screen.getByLabelText('compose.fields.to'), {
    target: { value: 'second@example.com' },
  });
  fireEvent.change(screen.getByLabelText('compose.fields.bcc'), {
    target: { value: 'private@example.com' },
  });
  expect(draft()).toEqual({
    to: 'first@example.com, second@example.com',
    cc: 'copy@example.com',
    bcc: 'private@example.com',
  });
});
it('selecting a suggestion replaces only the unfinished address, and chip removal preserves it', () => {
  render(<Fixture />);
  fireEvent.change(screen.getByLabelText('compose.fields.to'), {
    target: { value: 'sug' },
  });
  fireEvent.click(screen.getByText('compose.fields.to suggestion'));
  expect(draft().to).toBe('first@example.com, suggested@example.com, ');
  fireEvent.change(screen.getByLabelText('compose.fields.to'), {
    target: { value: 'unfinished' },
  });
  fireEvent.click(screen.getByText('first@example.com'));
  expect(draft().to).toBe('suggested@example.com, unfinished');
  expect(draft().cc).toBe('copy@example.com');
});
