import { buildReplyHeaders } from '@/utils/replyHeaders';

describe('buildReplyHeaders', () => {
  it('uses the RFC Message-Id and extends the reference chain', () => {
    expect(
      buildReplyHeaders({
        messageId: '<parent@amazon.com>',
        references: ['<root@amazon.com>'],
      }),
    ).toEqual({
      inReplyTo: '<parent@amazon.com>',
      references: ['<root@amazon.com>', '<parent@amazon.com>'],
    });
  });

  it('starts a chain for a first reply and never repeats an id', () => {
    expect(buildReplyHeaders({ messageId: '<p@x>', references: undefined }).references).toEqual([
      '<p@x>',
    ]);
    expect(
      buildReplyHeaders({ messageId: '<p@x>', references: ['<r@x>', '<p@x>'] }).references,
    ).toEqual(['<r@x>', '<p@x>']);
  });
});

describe('buildReplyHeaders against the RFC msg-id contract', () => {
  it('repairs a Message-Id written without angle brackets', () => {
    expect(buildReplyHeaders({ messageId: 'abc@mailer.example', references: [] })).toEqual({
      inReplyTo: '<abc@mailer.example>',
      references: ['<abc@mailer.example>'],
    });
  });

  it('never sends a database row id or a malformed reference', () => {
    const headers = buildReplyHeaders({
      messageId: '01a0821a-7395-7e43-bdb4-fa5166ea32d1',
      references: [
        '<01a0821a-7395-7e43-bdb4-fa5166ea32d1>',
        'garbage with spaces',
        '<root@amazon.com>',
      ],
    });
    expect(headers.inReplyTo).toBeUndefined();
    expect(headers.references).toEqual(['<root@amazon.com>']);
  });
});
