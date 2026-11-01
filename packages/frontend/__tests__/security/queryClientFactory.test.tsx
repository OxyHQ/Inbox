import { render, waitFor } from '@testing-library/react';
import { onlineManager, QueryClientProvider, useQuery } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';

const mockApi = {
  updateFlags: jest.fn(async () => ({})),
  moveMessage: jest.fn(async () => ({})),
  deleteMessage: jest.fn(async () => ({})),
  updateLabels: jest.fn(async () => ({})),
  snoozeMessage: jest.fn(async () => ({})),
  unsnoozeMessage: jest.fn(async () => ({})),
  bulkUpdateFlags: jest.fn(async () => ({})),
  bulkMoveMessages: jest.fn(async () => ({})),
};
jest.mock('@/hooks/useEmail', () => ({ useEmailStore: { getState: () => ({ _api: mockApi }) } }));

it('creates independent clients with the singleton defaults and no extra app listener', () => {
  const subscribe = jest.spyOn(onlineManager, 'subscribe');
  const {
    createInboxQueryClient,
    INBOX_MUTATION_KEYS,
    queryClient,
  } = require('@/hooks/queries/queryClient');
  expect(subscribe).toHaveBeenCalledTimes(1);
  const a = createInboxQueryClient();
  const b = createInboxQueryClient();
  expect(subscribe).toHaveBeenCalledTimes(1);
  expect(a).not.toBe(b);
  expect(a.getDefaultOptions()).toEqual(queryClient.getDefaultOptions());
  expect(b.getDefaultOptions()).toEqual(queryClient.getDefaultOptions());
  for (const key of Object.values(INBOX_MUTATION_KEYS)) {
    const expected = queryClient.getMutationDefaults(key);
    for (const client of [a, b]) {
      const actual = client.getMutationDefaults(key);
      expect({ ...actual, mutationFn: undefined }).toEqual({ ...expected, mutationFn: undefined });
      expect(actual.mutationFn).toEqual(expect.any(Function));
    }
  }
  a.clear();
  b.clear();
  queryClient.clear();
  expect(subscribe).toHaveBeenCalledTimes(1);
  subscribe.mockRestore();
});

it('registers equivalent replay functions for every existing mutation type', async () => {
  const {
    createInboxQueryClient,
    INBOX_MUTATION_KEYS: keys,
    queryClient,
  } = require('@/hooks/queries/queryClient');
  const client = createInboxQueryClient();
  const cases = [
    [keys.toggleStar, { messageId: 'm1', starred: true }],
    [keys.toggleRead, { messageId: 'm1', seen: true }],
    [keys.archive, { messageId: 'm1', archiveMailboxId: 'archive' }],
    [keys.delete, { messageId: 'm1', isInTrash: true }],
    [keys.delete, { messageId: 'm1', isInTrash: false, trashMailboxId: 'trash' }],
    [keys.delete, { messageId: 'm1', isInTrash: false }],
    [keys.togglePin, { messageId: 'm1', pinned: true }],
    [keys.updateLabels, { messageId: 'm1', add: ['a'], remove: ['b'] }],
    [keys.snooze, { messageIds: ['m1', 'm2'], until: '2030-01-01' }],
    [keys.unsnooze, { messageId: 'm1' }],
    [keys.bulkFlags, { messageIds: ['m1', 'm2'], flags: { seen: true } }],
    [keys.bulkMove, { messageIds: ['m1', 'm2'], mailboxId: 'folder' }],
  ] as const;
  const calls = () =>
    Object.fromEntries(Object.entries(mockApi).map(([name, fn]) => [name, fn.mock.calls]));
  for (const [key, variables] of cases) {
    jest.clearAllMocks();
    await queryClient.getMutationDefaults(key).mutationFn(variables);
    const expected = calls();
    jest.clearAllMocks();
    await client.getMutationDefaults(key).mutationFn(variables);
    expect(calls()).toEqual(expected);
  }
  client.clear();
});

function Reader() {
  useQuery({ queryKey: ['synthetic-observer'], queryFn: async () => 'synthetic', enabled: false });
  return null;
}
function tree(client: QueryClient, key: string) {
  return (
    <QueryClientProvider key={key} client={client}>
      <Reader />
    </QueryClientProvider>
  );
}

it('detaches a keyed subtree observer before using another factory client', async () => {
  const { createInboxQueryClient } = require('@/hooks/queries/queryClient');
  const a = createInboxQueryClient();
  const b = createInboxQueryClient();
  const view = render(tree(a, 'A'));
  await waitFor(() =>
    expect(
      a
        .getQueryCache()
        .find({ queryKey: ['synthetic-observer'] })
        ?.getObserversCount(),
    ).toBe(1),
  );
  view.rerender(tree(b, 'B'));
  await waitFor(() =>
    expect(
      a
        .getQueryCache()
        .find({ queryKey: ['synthetic-observer'] })
        ?.getObserversCount(),
    ).toBe(0),
  );
  expect(
    b
      .getQueryCache()
      .find({ queryKey: ['synthetic-observer'] })
      ?.getObserversCount(),
  ).toBe(1);
  view.unmount();
  a.clear();
  b.clear();
});
