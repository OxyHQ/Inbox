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
    canSelect: () => true,
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
jest.mock('@oxy.so/bloom/text-field', () => ({
  TextFieldInput: ({
    label,
    value,
    onChangeText,
    onFocus,
    onBlur,
    onEndEditing,
    inputRef,
  }: {
    label: string;
    value: string;
    onChangeText: (value: string) => void;
    onFocus: () => void;
    onBlur: (event: { nativeEvent: { text?: string } }) => void;
    onEndEditing: (event: { nativeEvent: { text: string } }) => void;
    inputRef: React.RefObject<HTMLInputElement | null>;
  }) => (
    <>
      <input
        ref={inputRef}
        aria-label={label}
        value={value}
        onChange={(event) => onChangeText(event.target.value)}
        onFocus={onFocus}
        onBlur={() => onBlur({ nativeEvent: {} })}
      />
      <button type="button" onClick={() => onEndEditing({ nativeEvent: { text: 'final input' } })}>
        end subject editing
      </button>
    </>
  ),
}));
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
it('forwards subject focus, blur, end-editing and input ref to the field', () => {
  const onFocus = jest.fn();
  const onBlur = jest.fn();
  const onEndEditing = jest.fn();
  const inputRef = { current: null } as React.RefObject<React.ComponentRef<
    typeof import('react-native').TextInput
  > | null>;
  render(
    <MailAddressFields
      to=""
      cc=""
      bcc=""
      onToChange={() => {}}
      onCcChange={() => {}}
      onBccChange={() => {}}
      subject=""
      onSubjectChange={() => {}}
      onSubjectFocus={onFocus}
      onSubjectBlur={onBlur}
      onSubjectEndEditing={onEndEditing}
      subjectInputRef={inputRef}
    />,
  );
  const input = screen.getByLabelText('compose.placeholders.subject');
  expect(inputRef.current).toBe(input);
  fireEvent.focus(input);
  fireEvent.blur(input);
  fireEvent.click(screen.getByRole('button', { name: 'end subject editing' }));
  expect(onFocus).toHaveBeenCalledTimes(1);
  expect(onBlur).toHaveBeenCalledWith(undefined);
  expect(onEndEditing).toHaveBeenCalledWith('final input');
});
