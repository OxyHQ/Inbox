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
    expect(buildReplyHeaders({ messageId: '<p@x>', references: undefined }).references).toEqual(['<p@x>']);
    expect(buildReplyHeaders({ messageId: '<p@x>', references: ['<r@x>', '<p@x>'] }).references).toEqual([
      '<r@x>',
      '<p@x>',
    ]);
  });
});
