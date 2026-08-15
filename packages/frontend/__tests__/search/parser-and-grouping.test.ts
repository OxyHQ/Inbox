import type { Message } from '@/services/emailApi';
import {
  collapseThreads,
  formatSearchInterpretation,
  parseSearchQuery,
} from '@/utils/threadGrouping';

const baseMessage: Message = {
  _id: 'message-1',
  userId: 'user-1',
  mailboxId: 'mailbox-1',
  messageId: '<message-1@example.test>',
  from: { address: 'sender@example.test' },
  to: [],
  subject: 'Project update',
  attachments: [],
  flags: {
    seen: true,
    starred: false,
    answered: false,
    forwarded: false,
    draft: false,
    pinned: false,
  },
  labels: [],
  size: 0,
  inReplyTo: null,
  references: [],
  date: '2026-01-02T00:00:00.000Z',
  receivedAt: '2026-01-02T00:00:00.000Z',
};

function message(overrides: Partial<Message>): Message {
  return {
    ...baseMessage,
    ...overrides,
    flags: { ...baseMessage.flags, ...overrides.flags },
  };
}

describe('parseSearchQuery', () => {
  it('parses quoted and structured operators without losing their values', () => {
    expect(
      parseSearchQuery(
        'in:inbox is:read from:"Alice Smith" to:bob@example.test subject:"Q2 budget" has:attachment label:"Finance Team" after:2026-01-01 before:2026-02-01 "status update"',
      ),
    ).toEqual({
      text: 'status update',
      mailbox: 'inbox',
      unread: false,
      from: 'Alice Smith',
      to: 'bob@example.test',
      subject: 'Q2 budget',
      hasAttachment: true,
      label: 'Finance Team',
      after: '2026-01-01',
      before: '2026-02-01',
    });
  });

  it('keeps unsupported operators as ordinary search text', () => {
    expect(parseSearchQuery('is:flagged budget')).toEqual({
      text: 'is:flagged budget',
    });
  });

  it('renders read and unread as distinct interpretations', () => {
    expect(formatSearchInterpretation({ unread: true })).toBe('unread');
    expect(formatSearchInterpretation({ unread: false })).toBe('read');
  });
});

describe('collapseThreads', () => {
  it('joins an RFC reply chain, keeps the newest representative, and carries unread state', () => {
    const reply = message({
      _id: 'message-2',
      messageId: '<message-2@example.test>',
      inReplyTo: '<message-1@example.test>',
      date: '2026-01-03T00:00:00.000Z',
      flags: { seen: false },
    });
    const unrelated = message({
      _id: 'message-3',
      messageId: '<message-3@example.test>',
      date: '2026-01-04T00:00:00.000Z',
    });

    const result = collapseThreads([reply, baseMessage, unrelated]);

    expect(result).toHaveLength(2);
    expect(result[0]?._id).toBe('message-2');
    expect(result[0]?.threadCount).toBe(2);
    expect(result[0]?.flags.seen).toBe(false);
    expect(result[1]?._id).toBe('message-3');
  });

  it('does not merge unrelated messages that only share a subject', () => {
    const second = message({
      _id: 'message-2',
      messageId: '<message-2@example.test>',
      date: '2026-01-03T00:00:00.000Z',
    });

    expect(collapseThreads([baseMessage, second])).toHaveLength(2);
  });
});
