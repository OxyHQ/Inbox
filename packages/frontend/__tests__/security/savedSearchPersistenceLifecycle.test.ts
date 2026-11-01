import { dirname, join } from 'node:path';
import { QueryClient } from '@tanstack/react-query';
import { INBOX_ACCOUNT_QUERIES, INBOX_MUTATION_KEYS } from '@/hooks/queries/queryClient';
import { SAVED_SEARCH_MUTATION_KEYS } from '@/hooks/queries/queryKeys';

const sdk = dirname(require.resolve('@oxy.so/services/package.json'));
const { accountQueryOwnership, createAccountQueryPersistence } = require(
  join(sdk, 'lib/commonjs/ui/hooks/accountQueryPersistence.js'),
);
const { snapshot } = require(join(sdk, 'lib/commonjs/ui/hooks/persistedQueryCache.js'));

it('does not persist saved-search mutations and preserves the separate account queues', async () => {
  const ownership = accountQueryOwnership(INBOX_ACCOUNT_QUERIES);
  const makeBlob = (messageId: string) => {
    const seed = new QueryClient();
    const star = seed
      .getMutationCache()
      .build(seed, { mutationKey: INBOX_MUTATION_KEYS.toggleStar });
    star.state = {
      ...star.state,
      status: 'pending',
      isPaused: true,
      variables: { messageId, starred: true },
    };
    const result = snapshot(seed, {
      persistsQuery: ownership.persistsQuery,
      shouldDehydrateMutation: (mutation: typeof star) =>
        mutation.state.isPaused && ownership.persistsMutation(mutation),
    });
    seed.clear();
    return result;
  };
  const storageMap = new Map([
    ['oxy_account_queries:alice', makeBlob('alice-message')],
    ['oxy_account_queries:bob', makeBlob('bob-message')],
  ]);
  const storage = {
    getItem: async (key: string) => storageMap.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      storageMap.set(key, value);
    },
    removeItem: async (key: string) => {
      storageMap.delete(key);
    },
  };
  const client = new QueryClient();
  const persistence = createAccountQueryPersistence(client, INBOX_ACCOUNT_QUERIES);
  persistence.setStorage(storage);
  persistence.attach();
  try {
    persistence.activate('alice');
    await persistence.whenReady();
    const pending = client
      .getMutationCache()
      .build(client, { mutationKey: SAVED_SEARCH_MUTATION_KEYS.create });
    pending.state = {
      ...pending.state,
      status: 'pending',
      isPaused: true,
      variables: { input: { name: 'synthetic' } },
    };
    expect(ownership.ownsMutation(pending)).toBe(true);
    expect(ownership.persistsMutation(pending)).toBe(false);
    persistence.activate('bob');
    await persistence.whenReady();
    const aliceBlob = storageMap.get('oxy_account_queries:alice');
    expect(aliceBlob).toBeDefined();
    const alice = JSON.parse(aliceBlob ?? 'null');
    expect(alice.clientState.mutations.map((m: { mutationKey: unknown }) => m.mutationKey)).toEqual(
      [INBOX_MUTATION_KEYS.toggleStar],
    );
    expect(
      client
        .getMutationCache()
        .getAll()
        .map((m) => m.state.variables),
    ).toEqual([{ messageId: 'bob-message', starred: true }]);
  } finally {
    persistence.detach();
    client.clear();
  }
});
