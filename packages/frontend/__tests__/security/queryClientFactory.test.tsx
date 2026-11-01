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
  const expectedDefaults = {
    queries: {
      staleTime: 60_000,
      retry: 2,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      networkMode: 'offlineFirst',
    },
    mutations: { networkMode: 'offlineFirst', retry: 0 },
  };
  expect(INBOX_MUTATION_KEYS).toEqual({
    toggleStar: ['inbox', 'message', 'toggle-star'],
    toggleRead: ['inbox', 'message', 'toggle-read'],
    archive: ['inbox', 'message', 'archive'],
    delete: ['inbox', 'message', 'delete'],
    togglePin: ['inbox', 'message', 'toggle-pin'],
    updateLabels: ['inbox', 'message', 'labels'],
    snooze: ['inbox', 'message', 'snooze'],
    unsnooze: ['inbox', 'message', 'unsnooze'],
    bulkFlags: ['inbox', 'messages', 'flags'],
    bulkMove: ['inbox', 'messages', 'move'],
  });
  expect(a.getDefaultOptions()).toEqual(expectedDefaults);
  expect(b.getDefaultOptions()).toEqual(expectedDefaults);
  expect(queryClient.getDefaultOptions()).toEqual(expectedDefaults);
  for (const key of Object.values(INBOX_MUTATION_KEYS)) {
    for (const client of [a, b, queryClient]) {
      const actual = client.getMutationDefaults(key);
      expect(actual).toEqual({
        networkMode: 'offlineFirst',
        retry: 1,
        mutationFn: expect.any(Function),
      });
    }
  }
  a.clear();
  b.clear();
  queryClient.clear();
  expect(subscribe).toHaveBeenCalledTimes(1);
  subscribe.mockRestore();
});

it('registers the expected replay function for every existing mutation type', async () => {
  const {
    createInboxQueryClient,
    INBOX_MUTATION_KEYS: keys,
  } = require('@/hooks/queries/queryClient');
  const client = createInboxQueryClient();
  const cases = [
    [
      keys.toggleStar,
      { messageId: 'm1', starred: true },
      { updateFlags: [['m1', { starred: true }]] },
    ],
    [keys.toggleRead, { messageId: 'm1', seen: true }, { updateFlags: [['m1', { seen: true }]] }],
    [
      keys.archive,
      { messageId: 'm1', archiveMailboxId: 'archive' },
      { moveMessage: [['m1', 'archive']] },
    ],
    [keys.delete, { messageId: 'm1', isInTrash: true }, { deleteMessage: [['m1', true]] }],
    [
      keys.delete,
      { messageId: 'm1', isInTrash: false, trashMailboxId: 'trash' },
      { moveMessage: [['m1', 'trash']] },
    ],
    [keys.delete, { messageId: 'm1', isInTrash: false }, { deleteMessage: [['m1']] }],
    [
      keys.togglePin,
      { messageId: 'm1', pinned: true },
      { updateFlags: [['m1', { pinned: true }]] },
    ],
    [
      keys.updateLabels,
      { messageId: 'm1', add: ['a'], remove: ['b'] },
      { updateLabels: [['m1', ['a'], ['b']]] },
    ],
    [
      keys.snooze,
      { messageIds: ['m1', 'm2'], until: '2030-01-01' },
      {
        snoozeMessage: [
          ['m1', '2030-01-01'],
          ['m2', '2030-01-01'],
        ],
      },
    ],
    [keys.unsnooze, { messageId: 'm1' }, { unsnoozeMessage: [['m1']] }],
    [
      keys.bulkFlags,
      { messageIds: ['m1', 'm2'], flags: { seen: true } },
      { bulkUpdateFlags: [[['m1', 'm2'], { seen: true }]] },
    ],
    [
      keys.bulkMove,
      { messageIds: ['m1', 'm2'], mailboxId: 'folder' },
      { bulkMoveMessages: [[['m1', 'm2'], 'folder']] },
    ],
  ] as const;
  for (const [key, variables, expected] of cases) {
    jest.clearAllMocks();
    await client.getMutationDefaults(key).mutationFn(variables);
    const calls = Object.fromEntries(
      Object.entries(mockApi)
        .filter(([, fn]) => fn.mock.calls.length > 0)
        .map(([name, fn]) => [name, fn.mock.calls]),
    );
    expect(calls).toEqual(expected);
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
