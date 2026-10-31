import { dirname, join } from 'node:path';
import { QueryClient, dehydrate, onlineManager } from '@tanstack/react-query';
import {
  INBOX_ACCOUNT_QUERIES,
  INBOX_MUTATION_KEYS,
  queryClient,
  resumeInboxMutations,
} from '@/hooks/queries/queryClient';
import { useEmailStore } from '@/hooks/useEmail';

const sdkDirectory = dirname(require.resolve('@oxy.so/services/package.json'));
const { createAccountQueryPersistence } = require(
  join(sdkDirectory, 'lib/commonjs/ui/hooks/accountQueryPersistence.js'),
);
const { attachQueryPersistence } = require(
  join(sdkDirectory, 'lib/commonjs/ui/hooks/queryClient.js'),
);

const key = 'oxy_query_cache_v3';
function storage(initial: Record<string, string> = {}) {
  const entries = new Map(Object.entries(initial));
  return {
    entries,
    getItem: async (k: string) => entries.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      entries.set(k, v);
    },
    removeItem: async (k: string) => {
      entries.delete(k);
    },
  };
}
function paused(client: QueryClient, mutationKey: readonly unknown[], variables: unknown) {
  const m = client
    .getMutationCache()
    .build(client, { mutationKey, mutationFn: async () => undefined });
  m.state = { ...m.state, status: 'pending', isPaused: true, variables };
}
function blob(client: QueryClient): string {
  return JSON.stringify({
    buster: 'audit',
    timestamp: Date.now(),
    clientState: dehydrate(client, { shouldDehydrateMutation: () => true }),
  });
}
const config = { ...INBOX_ACCOUNT_QUERIES, clearUnregisteredMutations: true };
afterEach(() => {
  onlineManager.setOnline(true);
  queryClient.clear();
  useEmailStore.setState({ _api: null });
});

it('restores registered Inbox operations only from their account, then resumes with the registered defaults', async () => {
  onlineManager.setOnline(false);
  queryClient.clear();
  const seed = new QueryClient();
  const variables = {
    toggleStar: { messageId: 'star', starred: true },
    toggleRead: { messageId: 'read', seen: true },
    archive: { messageId: 'archive', archiveMailboxId: 'archive-folder' },
    delete: { messageId: 'delete', isInTrash: true },
    togglePin: { messageId: 'pin', pinned: true },
    updateLabels: { messageId: 'labels', add: ['work'], remove: [] },
    snooze: { messageIds: ['snooze'], until: '2030-01-01T00:00:00Z' },
    unsnooze: { messageId: 'unsnooze' },
    bulkFlags: { messageIds: ['bulkflags'], flags: { seen: true } },
    bulkMove: { messageIds: ['bulkmove'], mailboxId: 'archive-folder' },
  };
  for (const name of Object.keys(INBOX_MUTATION_KEYS) as (keyof typeof INBOX_MUTATION_KEYS)[])
    paused(seed, INBOX_MUTATION_KEYS[name], variables[name]);
  paused(seed, ['unknown'], { secret: 'unregistered' });
  const legacy = new QueryClient();
  paused(legacy, INBOX_MUTATION_KEYS.toggleStar, {
    messageId: 'legacy-valid-but-unowned',
    starred: true,
  });
  paused(legacy, ['unknown'], { secret: 'legacy-private' });
  const store = storage({ [key]: blob(legacy), 'oxy_account_queries:alice': blob(seed) });
  const shared = attachQueryPersistence(queryClient, store, config);
  await shared.restored;
  expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
  const persistence = createAccountQueryPersistence(queryClient, config);
  persistence.setStorage(store);
  persistence.attach();
  persistence.activate('alice');
  await persistence.whenReady();
  const restored = queryClient.getMutationCache().getAll();
  expect(restored).toHaveLength(10);
  expect(restored.map((m) => m.options.mutationKey)).toEqual(Object.values(INBOX_MUTATION_KEYS));
  const api = {
    updateFlags: jest.fn().mockResolvedValue({}),
    moveMessage: jest.fn().mockResolvedValue({}),
    deleteMessage: jest.fn().mockResolvedValue({}),
    updateLabels: jest.fn().mockResolvedValue({}),
    snoozeMessage: jest.fn().mockResolvedValue({}),
    unsnoozeMessage: jest.fn().mockResolvedValue({}),
    bulkUpdateFlags: jest.fn().mockResolvedValue({}),
    bulkMoveMessages: jest.fn().mockResolvedValue({}),
  };
  useEmailStore.setState({ _api: api as never });
  onlineManager.setOnline(true);
  resumeInboxMutations();
  for (let i = 0; i < 200 && restored.some((m) => m.state.status !== 'success'); i++)
    await new Promise((resolve) => setTimeout(resolve, 5));
  expect(restored.every((m) => m.state.status === 'success')).toBe(true);
  expect(api.updateFlags).toHaveBeenCalledTimes(3);
  expect(api.moveMessage).toHaveBeenCalledTimes(1);
  expect(api.deleteMessage).toHaveBeenCalledTimes(1);
  expect(api.updateLabels).toHaveBeenCalledTimes(1);
  expect(api.snoozeMessage).toHaveBeenCalledTimes(1);
  expect(api.unsnoozeMessage).toHaveBeenCalledTimes(1);
  expect(api.bulkUpdateFlags).toHaveBeenCalledTimes(1);
  expect(api.bulkMoveMessages).toHaveBeenCalledTimes(1);
  await new Promise((resolve) => setTimeout(resolve, 1200));
  expect(store.entries.get(key)).not.toContain('legacy-private');
  persistence.detach();
  shared.unsubscribe();
});
