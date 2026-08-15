import type { Message } from '@/services/emailApi';
import { getFollowUpReason } from '@/hooks/queries/useFollowUp';

jest.mock('@/hooks/queries/useMessages', () => ({ useMessages: jest.fn() }));
jest.mock('@/hooks/queries/useMailboxes', () => ({ useMailboxes: jest.fn() }));

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    _id: 'sent-1',
    userId: 'user-1',
    mailboxId: 'sent-1',
    messageId: 'sent-message-1',
    from: { address: 'me@example.com' },
    to: [{ address: 'recipient@example.com' }],
    subject: 'Project update',
    text: 'Could you take a look?',
    attachments: [],
    flags: { seen: true, starred: false, pinned: false },
    labels: [],
    card: null,
    date: '2026-08-10T10:00:00.000Z',
    receivedAt: '2026-08-10T10:00:00.000Z',
    ...overrides,
  };
}

const now = new Date('2026-08-15T10:00:00.000Z');

describe('follow-up triage', () => {
  it('promotes an old sent message when no reply is detected', () => {
    expect(getFollowUpReason(makeMessage(), [], now)).toBe('awaiting-reply');
  });

  it('does not promote a message with a referenced reply', () => {
    const sent = makeMessage();
    const reply = makeMessage({
      _id: 'reply-1',
      mailboxId: 'inbox-1',
      messageId: 'reply-message-1',
      from: { address: 'recipient@example.com' },
      inReplyTo: sent.messageId,
      date: '2026-08-12T10:00:00.000Z',
    });

    expect(getFollowUpReason(sent, [reply], now)).toBeNull();
  });

  it('keeps human support addresses eligible and skips no-reply addresses', () => {
    expect(
      getFollowUpReason(
        makeMessage({ to: [{ address: 'support@example.com' }] }),
        [],
        now,
      ),
    ).toBe('awaiting-reply');
    expect(
      getFollowUpReason(
        makeMessage({ to: [{ address: 'no-reply@example.com' }] }),
        [],
        now,
      ),
    ).toBeNull();
  });
});
