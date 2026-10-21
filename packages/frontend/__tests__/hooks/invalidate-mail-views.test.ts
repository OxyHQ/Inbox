/**
 * Every place mail is shown is reconciled after mail changes. Only the lists
 * and the counts used to be, so a sent draft stayed in search results, in its
 * bundle and open in the conversation view.
 */

import { invalidateMailViews } from '@/hooks/queries/invalidateMailViews';

function client() {
  return { invalidateQueries: jest.fn() };
}

function calls(qc: ReturnType<typeof client>) {
  return qc.invalidateQueries.mock.calls.map(([f]) => ({
    root: (f as { queryKey: unknown[] }).queryKey[0],
    refetchType: (f as { refetchType?: string }).refetchType,
  }));
}

it('re-reads every view that shows mail', () => {
  const qc = client();
  invalidateMailViews(qc as never);
  expect(calls(qc).map((c) => c.root)).toEqual(
    expect.arrayContaining(['messages', 'message', 'thread', 'search', 'mailboxes']),
  );
  expect(calls(qc).filter((c) => c.refetchType === 'none')).toEqual([]);
});

it('never re-reads the bundle configuration, which no change to mail touches', () => {
  const qc = client();
  invalidateMailViews(qc as never);
  invalidateMailViews(qc as never, { views: 'stale' });
  expect(calls(qc).map((c) => c.root)).not.toContain('bundles');
});

it('after an optimistic patch, only marks the patched views stale but re-reads search', () => {
  const qc = client();
  invalidateMailViews(qc as never, { views: 'stale' });
  const byRoot = Object.fromEntries(calls(qc).map((c) => [c.root, c.refetchType]));
  expect(byRoot).toMatchObject({ messages: 'none', message: 'none', thread: 'none' });
  expect(byRoot.search).toBeUndefined();
  expect(byRoot.bundles).toBeUndefined();
  expect(byRoot.mailboxes).toBeUndefined();
});
