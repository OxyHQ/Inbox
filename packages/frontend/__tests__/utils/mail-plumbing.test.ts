/**
 * The plumbing under the composer and the lists: the plain-text part of a web
 * message, the rollback of a failed action, and the request limits of the API.
 */

import { QueryClient } from '@tanstack/react-query';

import { emailKeys } from '@/hooks/queries/queryKeys';
import { MessageSchema, type Message } from '@/schemas/emailSchemas';
import { createEmailApi } from '@/services/emailApi';
import { restoreSnapshot, snapshotForRollback, type MessagesInfinite } from '@/utils/messageCache';
import { buildReplyHeaders } from '@/utils/replyHeaders';
import { stripHtml } from '@/utils/stripHtml';
import { wireMessage } from '../fixtures/wire';

describe('stripHtml — the text part of what the web composer sends', () => {
  it('keeps every line break the editor shows', () => {
    expect(stripHtml('Hi Ann<br><br>Thanks,<div>Line two</div><br>--<br>Nate')).toBe(
      'Hi Ann\n\nThanks,\nLine two\n\n--\nNate',
    );
    expect(stripHtml('<div>a</div><div><br></div><div>b</div>')).toBe('a\n\nb');
  });

  it('quotes a blockquote with "> "', () => {
    expect(stripHtml('Hi<div>Bob wrote:</div><blockquote type="cite">one<br>two</blockquote>')).toBe(
      'Hi\nBob wrote:\n> one\n> two',
    );
  });

  it('decodes entities, lists paragraphs and items, and drops what is never shown', () => {
    expect(stripHtml('<p>One &amp; two</p><ul><li>x</li><li>y</li></ul><ol><li>a</li></ol>')).toBe(
      'One & two\n\n- x\n- y\n1. a',
    );
    expect(stripHtml('<style>p{}</style><script>x()</script>It&#39;s <b>fine</b>')).toBe("It's fine");
  });

  it('never makes the markup live: an onerror handler does not run', () => {
    const spy = jest.fn();
    (globalThis as { __strip?: () => void }).__strip = spy;
    stripHtml('<img src="x" onerror="globalThis.__strip()">text');
    expect(spy).not.toHaveBeenCalled();
  });
});

function msg(id: string, seen = false): Message {
  return MessageSchema.parse(
    wireMessage({
      _id: id,
      id,
      flags: { seen, starred: false, answered: false, forwarded: false, draft: false, pinned: false },
    }),
  );
}

function list(...messages: Message[]): MessagesInfinite {
  return {
    pageParams: [undefined],
    pages: [{ data: messages, pagination: { total: messages.length, limit: 50, offset: 0, hasMore: false } }],
  };
}

describe('restoreSnapshot — a failed action undoes only itself', () => {
  const key = emailKeys.messages.root;
  const ids = (client: QueryClient) =>
    client.getQueryData<MessagesInfinite>(key)?.pages[0].data.map((m) => m._id);

  it('brings back the failed message without undoing one archived since', () => {
    const client = new QueryClient();
    client.setQueryData(key, list(msg('a'), msg('b'), msg('c')));

    // Archive A, then B. A's request fails; B's succeeded.
    const snapshotA = snapshotForRollback(client, 'a', null);
    client.setQueryData(key, list(msg('b'), msg('c')));
    client.setQueryData(key, list(msg('c')));
    restoreSnapshot(client, snapshotA);

    expect(ids(client)).toEqual(['a', 'c']);
  });

  it('puts a changed message back as it was, and leaves the others as they are now', () => {
    const client = new QueryClient();
    client.setQueryData(key, list(msg('a'), msg('b')));
    const snapshot = snapshotForRollback(client, ['a'], null);
    client.setQueryData(key, list(msg('a', true), msg('b', true)));
    restoreSnapshot(client, snapshot);

    const [a, b] = client.getQueryData<MessagesInfinite>(key)!.pages[0].data;
    expect(a.flags.seen).toBe(false);
    expect(b.flags.seen).toBe(true);
  });
});

describe('bulk requests stay within the API limit', () => {
  it('sends 250 ids as three requests of at most 100', async () => {
    const http = { post: jest.fn().mockResolvedValue({ matched: 1, modified: 1 }) };
    const api = createEmailApi(http as never);
    const messageIds = Array.from({ length: 250 }, (_, i) => `m${i}`);

    const result = await api.bulkMoveMessages(messageIds, 'archive');

    const sizes = http.post.mock.calls.map(([, body]) => (body as { messageIds: string[] }).messageIds.length);
    expect(sizes).toEqual([100, 100, 50]);
    expect(result).toEqual({ matched: 3, modified: 3 });
  });
});

describe('References in a long thread', () => {
  it('is cut to 100 ids, keeping the first and the most recent', () => {
    const references = Array.from({ length: 150 }, (_, i) => `<m${i}@x>`);
    const headers = buildReplyHeaders({ messageId: '<last@x>', references });
    expect(headers.references).toHaveLength(100);
    expect(headers.references[0]).toBe('<m0@x>');
    expect(headers.references.at(-1)).toBe('<last@x>');
  });
});
