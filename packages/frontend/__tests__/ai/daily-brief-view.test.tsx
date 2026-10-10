/**
 * Today's Brief draws the messages it names as mail rows a reader can open,
 * grouped by what they need, under a short summary.
 */

import { fireEvent, render, screen } from '@testing-library/react';

import { DailyBrief } from '@/components/DailyBrief';

const mockMarkOpened = jest.fn();
const mockRegenerate = jest.fn();
let mockState: Record<string, unknown> = {};

jest.mock('react-native', () => ({
  View: ({ children }: any) => <div>{children}</div>,
  StyleSheet: { create: (styles: unknown) => styles },
}));
jest.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'en' }),
}));
jest.mock('@/constants/theme', () => ({ useColors: () => ({ secondaryText: 'grey' }) }));
jest.mock('@/contexts/inbox-prefs-context', () => ({
  useInboxPrefs: () => ({ prefs: { aiBrief: true } }),
}));
jest.mock('@/hooks/queries/useDailyBrief', () => ({
  useDailyBrief: () => ({ markOpened: mockMarkOpened, regenerate: mockRegenerate, ...mockState }),
}));
jest.mock('@oxy.so/bloom/card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardBody: ({ children }: any) => <div>{children}</div>,
}));
jest.mock('@oxy.so/bloom/typography', () => ({
  Text: ({ children }: any) => <span>{children}</span>,
}));
jest.mock('@oxy.so/bloom/button', () => ({
  Button: ({ children, onPress }: any) => <button onClick={onPress}>{children}</button>,
}));
jest.mock('@oxy.so/bloom/mail-list', () => ({
  MailRow: ({ sender, subject, snippet, unread, onPress }: any) => (
    <button onClick={onPress} data-unread={String(unread)}>
      {`${sender.name} · ${subject} · ${snippet}`}
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
  beforeEach(() => jest.clearAllMocks());

  it('shows the summary and each named message as a row that opens it', () => {
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

    render(<DailyBrief onOpenMessage={onOpenMessage} />);

    expect(screen.getByText('NVIDIA wants a reply about the AWS credits.')).toBeTruthy();
    const headers = [
      'home.brief.sections.needsYou',
      'home.brief.sections.today',
      'home.brief.sections.earlier',
    ];
    for (const header of headers) expect(screen.getByText(header)).toBeTruthy();
    // A sender with no name is shown by address.
    expect(screen.getByText('b@example.com · Subject b · note b')).toBeTruthy();

    fireEvent.click(screen.getByText('Sender a · Subject a · note a'));
    expect(mockMarkOpened).toHaveBeenCalledWith('a');
    expect(onOpenMessage).toHaveBeenCalledWith('a');
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
    const { unmount } = render(<DailyBrief onOpenMessage={jest.fn()} />);
    expect(screen.getByText('home.brief.nothingNew')).toBeTruthy();
    unmount();

    mockState = { brief: undefined, isLoading: false, error: new Error('502') };
    render(<DailyBrief onOpenMessage={jest.fn()} />);
    expect(screen.getByText('home.brief.failed')).toBeTruthy();
    fireEvent.click(screen.getByText('common.retry'));
    expect(mockRegenerate).toHaveBeenCalled();
  });
});
