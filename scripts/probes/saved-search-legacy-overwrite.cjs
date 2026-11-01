const assert = require('node:assert/strict');
const { QueryClient } = require('@tanstack/react-query');
const { dirname, join } = require('node:path');
const sdk = dirname(require.resolve('@oxy.so/services/package.json'));
const { accountQueryOwnership, createAccountQueryPersistence } = require(
  join(sdk, 'lib/commonjs/ui/hooks/accountQueryPersistence.js'),
);
const { snapshot } = require(join(sdk, 'lib/commonjs/ui/hooks/persistedQueryCache.js'));

async function main() {
  const oldClient = new QueryClient();
  oldClient.setQueryData(['saved-searches'], [{ id: 'synthetic-A', name: 'synthetic' }]);
  oldClient.setQueryData(['mailboxes'], ['synthetic-mailbox']);
  const oldOwnership = accountQueryOwnership({ roots: ['saved-searches', 'mailboxes'] });
  const original = snapshot(oldClient, {
    persistsQuery: oldOwnership.persistsQuery,
    shouldDehydrateMutation: () => false,
  });
  const storageMap = new Map([['oxy_account_queries:subject-1', original]]);
  let written;
  const writeFinished = new Promise((resolve) => {
    written = resolve;
  });
  const storage = {
    getItem: async (key) => storageMap.get(key) ?? null,
    setItem: async (key, value) => {
      storageMap.set(key, value);
      written();
    },
    removeItem: async (key) => {
      storageMap.delete(key);
    },
  };
  const current = new QueryClient();
  const persistence = createAccountQueryPersistence(current, {
    roots: ['mailboxes'],
    memoryOnlyRoots: ['saved-searches'],
  });
  persistence.setStorage(storage);
  persistence.attach();
  persistence.activate('subject-1');
  await persistence.whenReady();
  assert.equal(current.getQueryData(['saved-searches']), undefined);
  assert.deepEqual(current.getQueryData(['mailboxes']), ['synthetic-mailbox']);
  current.setQueryData(['mailboxes'], ['synthetic-mailbox', 'new-mailbox']);
  persistence.detach();
  await writeFinished;
  const blob = JSON.parse(storageMap.get('oxy_account_queries:subject-1'));
  const roots = blob.clientState.queries.map((q) => q.queryKey[0]);
  assert.equal(roots.includes('saved-searches'), false);
  assert.equal(roots.includes('mailboxes'), true);
  console.log(
    JSON.stringify({
      legacySavedSearchAbsentAfterRestore: true,
      oldBlobOverwrittenWithoutSavedSearch: true,
      unrelatedRootPreserved: true,
      syntheticOnly: true,
    }),
  );
  oldClient.clear();
  current.clear();
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
