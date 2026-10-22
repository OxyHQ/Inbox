/** The brief keeps its summary and message rows together without extra headings. */

import { fireEvent, render, screen } from '@testing-library/react';

import { MessageSchema } from '@/schemas/emailSchemas';
import { wireMessage } from '../fixtures/wire';
import type { Message } from '@/services/emailApi';
import { DailyBrief } from '@/components/DailyBrief';
import type { Children, Pressable } from '../fixtures/mockProps';

const mockMarkOpened = jest.fn();
const mockRegenerate = jest.fn();
let mockState: Record<string, unknown> = {};
let mockMessage: Message | null = null;
const mockUseMessage = jest.fn();

jest.mock('react-native', () => ({
  View: ({ children }: Children) => <div>{children}</div>,
}));
jest.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'en' }),
}));
jest.mock('@/contexts/inbox-prefs-context', () => ({
  useInboxPrefs: () => ({ prefs: { aiBrief: true } }),
}));
jest.mock('@/hooks/queries/useMessage', () => ({
  useMessage: (id: string | undefined) => {
    mockUseMessage(id);
    return { data: mockMessage };
  },
}));
jest.mock('@/hooks/queries/useDailyBrief', () => ({
  useDailyBrief: () => ({ regenerate: mockRegenerate, markOpened: mockMarkOpened, ...mockState }),
}));
jest.mock('@oxy.so/bloom/card', () => ({
  Card: ({ children }: Children) => <div data-testid="brief-card">{children}</div>,
  CardBody: ({ children }: Children) => <div>{children}</div>,
}));
jest.mock('@oxy.so/bloom/mail-list', () => ({
  MailRow: ({
    sender,
    subject,
    snippet,
    onPress,
  }: Pressable & {
    sender: { name: string };
    subject: string;
    snippet: string;
  }) => (
    <button type="button" onClick={onPress}>
      {`${sender.name} · ${subject} · ${snippet}`}
    </button>
  ),
}));
jest.mock('@oxy.so/bloom/typography', () => ({
  Text: ({ children }: Children) => <span>{children}</span>,
}));
jest.mock('@oxy.so/bloom/button', () => ({
  Button: ({ children, onPress }: Pressable) => (
    <button type="button" onClick={onPress}>
      {children}
    </button>
  ),
}));
function item(id: string, section: string, overrides: Record<string, unknown> = {}) {
  return {
    messageId: id,
    section,
    note: `note ${id}`,
    from: { name: `Sender ${id}`, address: `${id}@example.com` },
    subject: `Subject ${id}`,
    receivedAt: new Date().toISOString(),
    unread: true,
    hasAttachments: false,
    ...overrides,
  };
}

describe('DailyBrief', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMessage = null;
  });

  it('keeps the summary and openable messages in one card without extra headings', () => {
    mockState = {
      brief: {
        summary: 'NVIDIA wants a reply about the AWS credits.',
        counts: { received: 3, unread: 2, starred: 0, earlierUnread: 1 },
        items: [
          item('a', 'needs_you'),
          item('b', 'today', { unread: false, from: { name: null, address: 'b@example.com' } }),
          item('c', 'earlier'),
        ],
      },
      isLoading: false,
      error: null,
    };
    const onOpenMessage = jest.fn();
    render(<DailyBrief onOpenMessage={onOpenMessage} onAction={jest.fn()} />);

    expect(screen.getByText('NVIDIA wants a reply about the AWS credits.')).toBeTruthy();
    const headers = [
      'home.brief.sections.needsYou',
      'home.brief.sections.today',
      'home.brief.sections.earlier',
    ];
    for (const header of headers) expect(screen.queryByText(header)).toBeNull();
    const card = screen.getByTestId('brief-card');
    expect(card.contains(screen.getByText('NVIDIA wants a reply about the AWS credits.'))).toBe(
      true,
    );
    for (const subject of [/Subject a/, /Subject b/, /Subject c/]) {
      expect(card.contains(screen.getByText(subject))).toBe(true);
    }
    expect(screen.getByText('b@example.com · Subject b · note b')).toBeTruthy();
    fireEvent.click(screen.getByText(/Subject a/));
    expect(mockMarkOpened).toHaveBeenCalledWith('a');
    expect(onOpenMessage).toHaveBeenCalledWith('a');
  });

  it('shows current labels and attachments with the shared row without regenerating the cached brief', () => {
    mockState = {
      brief: { summary: 'Ana sent the proposal.', items: [item('a', 'today')] },
      isLoading: false,
      error: null,
    };
    const message = MessageSchema.parse(
      wireMessage({
        _id: 'a',
        labels: ['Work', 'Review'],
        attachments: [
          {
            fileId: 'file-a',
            name: 'proposal.pdf',
            contentType: 'application/pdf',
            size: 100,
            contentId: null,
            isInline: false,
          },
        ],
      }),
    );
    const renderMessage = (current: Message, note: string, onOpen: () => void) => (
      <button type="button" onClick={onOpen}>
        {current.labels.join(', ')} · {current.attachments.map((file) => file.name).join(', ')} ·{' '}
        {note}
      </button>
    );
    const onOpenMessage = jest.fn();
    const props = { onOpenMessage, onAction: jest.fn(), renderMessage };
    const view = render(<DailyBrief {...props} messages={[message]} />);
    expect(mockUseMessage).toHaveBeenLastCalledWith(undefined);
    expect(screen.getByText('Work, Review · proposal.pdf · note a')).toBeTruthy();
    view.rerender(<DailyBrief {...props} messages={[{ ...message, labels: ['Approved'] }]} />);
    fireEvent.click(screen.getByText('Approved · proposal.pdf · note a'));
    expect(onOpenMessage).toHaveBeenCalledWith('a');
    expect(mockMarkOpened).toHaveBeenCalledWith('a');
    expect(mockRegenerate).not.toHaveBeenCalled();
    // Older highlighted mail may not be in the first loaded inbox page.
    mockMessage = { ...message, labels: ['Earlier'] };
    view.rerender(<DailyBrief {...props} messages={[]} />);
    expect(mockUseMessage).toHaveBeenLastCalledWith('a');
    expect(screen.getByText('Earlier · proposal.pdf · note a')).toBeTruthy();
  });

  it('sends the chosen generated prompt and its message references to the Alia handler', () => {
    const actions = [
      { label: 'Draft reply', prompt: 'Help me draft a reply to Ana.', messageIds: ['a'] },
      {
        label: 'Review deadline',
        prompt: 'Review the deadline in the contract.',
        messageIds: ['b'],
      },
    ];
    mockState = {
      brief: { summary: 'Ana needs the contract reviewed.', items: [], actions },
      isLoading: false,
      error: null,
    };
    const onAction = jest.fn();
    render(<DailyBrief onOpenMessage={jest.fn()} onAction={onAction} />);
    expect(onAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Review deadline' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith(actions[1]);
  });

  it('says so on a day with nothing in it, and offers Retry on failure', () => {
    mockState = {
      brief: {
        summary: '',
        counts: { received: 0, unread: 0, starred: 0, earlierUnread: 0 },
        items: [],
      },
      isLoading: false,
      error: null,
    };
    const { unmount } = render(<DailyBrief onOpenMessage={jest.fn()} onAction={jest.fn()} />);
    expect(screen.getByText('home.brief.nothingNew')).toBeTruthy();
    unmount();

    mockState = { brief: undefined, isLoading: false, error: new Error('502') };
    render(<DailyBrief onOpenMessage={jest.fn()} onAction={jest.fn()} />);
    expect(screen.getByText('home.brief.failed')).toBeTruthy();
    fireEvent.click(screen.getByText('common.retry'));
    expect(mockRegenerate).toHaveBeenCalled();
  });
});
