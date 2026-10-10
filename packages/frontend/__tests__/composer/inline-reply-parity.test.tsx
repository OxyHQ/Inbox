/**
 * An inline reply is the same composer as a new message.
 *
 * It used to be a separate, smaller UI with no attachments, no subject, no AI
 * writing, no save-draft or scheduled send, and Discard without a prompt. Both
 * now render `MailComposer`; this renders an inline reply and asserts every
 * one of those is there.
 */

import { fireEvent, render, screen } from '@testing-library/react';

import { InlineReply } from '@/components/InlineReply';
import type { Message } from '@/services/emailApi';

const mockSession = {
  to: 'ana@example.com',
  cc: '',
  bcc: '',
  subject: 'Re: Plan',
  body: '',
  ownText: '',
  attachments: [{ fileId: 'file-1', name: 'plan.pdf', size: 2048 }],
  hasContent: true,
  isDirty: true,
  sending: false,
  sendDisabled: false,
  alreadyQueued: false,
  draftStatusLabel: null,
  draftSaveError: null,
  setTo: jest.fn(),
  setCc: jest.fn(),
  setBcc: jest.fn(),
  setSubject: jest.fn(),
  updateBody: jest.fn(),
  replaceOwnText: jest.fn(),
  insertText: jest.fn(),
  addFiles: jest.fn(),
  removeAttachment: jest.fn(),
  send: jest.fn(),
  schedule: jest.fn(),
  saveAndClose: jest.fn(),
  discardDraft: jest.fn(),
  discardChanges: jest.fn(),
};
const mockShowBottomSheet = jest.fn();
const mockDialogOpen = jest.fn();

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
  View: ({ children }: any) => <div>{children}</div>,
  ScrollView: ({ children }: any) => <div data-testid="scroll">{children}</div>,
}));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/constants/theme', () => ({ useColors: () => ({ error: 'red', secondaryText: 'grey' }) }));
jest.mock('@oxy.so/services', () => ({
  useOxy: () => ({ user: { username: 'nate' }, showBottomSheet: mockShowBottomSheet }),
}));
jest.mock('@/hooks/useComposeSession', () => ({ useComposeSession: () => mockSession }));
jest.mock('@oxy.so/bloom', () => ({
  Dialog: ({ title, label, children, actions }: any) => (
    <div role="dialog" aria-label={title ?? label}>
      {children}
      {actions?.map((action: any) => <button key={action.label}>{action.label}</button>)}
    </div>
  ),
  useDialogControl: () => ({ open: mockDialogOpen, close: jest.fn() }),
  toast: jest.fn(),
}));
jest.mock('@oxy.so/bloom/card', () => ({ Card: ({ children }: any) => <div>{children}</div> }));
jest.mock('@oxy.so/bloom/admonition', () => ({ Admonition: ({ children }: any) => <div>{children}</div> }));
jest.mock('@oxy.so/bloom/typography', () => ({ Text: ({ children }: any) => <span>{children}</span> }));
jest.mock('@oxy.so/bloom/text-field', () => ({
  TextFieldInput: ({ label, value }: any) => <input aria-label={label} value={value} readOnly />,
}));
jest.mock('@oxy.so/bloom/button', () => ({
  Button: ({ children, onPress }: any) => <button onClick={onPress}>{children}</button>,
  IconButton: ({ accessibilityLabel, onPress }: any) => (
    <button aria-label={accessibilityLabel} onClick={onPress} />
  ),
}));
jest.mock('@oxy.so/bloom/icons', () => new Proxy({}, { get: () => () => null }));
jest.mock('@oxy.so/bloom/mail-thread', () => ({ MailQuoteToggle: ({ children }: any) => <div>{children}</div> }));
jest.mock('@oxy.so/bloom/mail-compose', () => ({
  MailComposeSurface: ({ title, onAttach, attachments, onDiscard, footer, children }: any) => (
    <section aria-label={title}>
      {onAttach && <button onClick={onAttach}>attach</button>}
      {attachments.map((item: any) => <span key={item.id}>{item.name}</span>)}
      <button onClick={onDiscard}>discard</button>
      {footer}
      {children}
    </section>
  ),
}));
jest.mock('@/components/MailAddressFields', () => ({
  MailAddressFields: ({ onSubjectChange }: any) => (
    <div>{onSubjectChange ? 'fields with subject' : 'fields without subject'}</div>
  ),
}));
jest.mock('@/components/AiComposeToolbar', () => ({ AiComposeToolbar: () => <div>ai toolbar</div> }));
jest.mock('@/components/RichTextEditor', () => ({ RichTextEditor: () => <div>editor</div> }));
jest.mock('@/components/TemplatePicker', () => ({ TemplatePicker: () => <div>templates</div> }));
jest.mock('@/components/ScheduleSendSheet', () => ({ ScheduleSendSheet: () => null }));
jest.mock('@/components/SmartReplyChips', () => ({ SmartReplyChips: () => <div>smart replies</div> }));

const message = {
  _id: 'message-1',
  subject: 'Plan',
  date: '2026-10-01T10:00:00.000Z',
  from: { name: 'Ana', address: 'ana@example.com' },
  to: [{ address: 'nate@oxy.so' }],
  cc: [],
  text: 'Here is the plan.',
} as unknown as Message;

describe('InlineReply', () => {
  beforeEach(() => jest.clearAllMocks());

  it('offers everything the full composer does', () => {
    render(<InlineReply message={message} mode="reply" onClose={jest.fn()} />);

    // Attachments: pick, list, and the session receives them.
    fireEvent.click(screen.getByText('attach'));
    expect(mockShowBottomSheet).toHaveBeenCalledWith(
      expect.objectContaining({ screen: 'FileManagement' }),
    );
    expect(screen.getByText('plan.pdf')).toBeTruthy();

    // Subject, sender, AI writing, templates, save draft, scheduled send.
    expect(screen.getByText('fields with subject')).toBeTruthy();
    expect(screen.getByLabelText('compose.fields.from')).toBeTruthy();
    expect(screen.getByText('ai toolbar')).toBeTruthy();
    expect(screen.getByText('templates')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('compose.actions.saveDraft'));
    expect(mockSession.saveAndClose).toHaveBeenCalled();
    expect(screen.getByText('compose.actions.scheduleSend')).toBeTruthy();

    // Discard asks first instead of throwing the draft away.
    fireEvent.click(screen.getByText('discard'));
    expect(mockDialogOpen).toHaveBeenCalled();
    expect(mockSession.discardDraft).not.toHaveBeenCalled();

    // What only a reply has stays.
    expect(screen.getByText('smart replies')).toBeTruthy();
    // Inline, the thread scrolls; the composer does not nest its own scroller.
    expect(screen.queryByTestId('scroll')).toBeNull();
  });
});
