/**
 * Inbox's per-account query cache: which queries and mutations belong to the
 * signed-in account, and their offline copy.
 *
 * Services 14 did this for Inbox (`OxyProvider accountQueries`). Services 15
 * dropped React Query altogether: its own data lives in one `@oxy.so/bloom-data`
 * store per account, and an app that uses React Query mounts its own client and
 * scopes it itself. Inbox's mail cache is a React Query cache, so this is the
 * Services 14 implementation, owned here, with the same rules:
 *
 * - Storage is keyed by the account (`inbox_account_queries:<accountId>`), so a
 *   restore can only ever hydrate the account that is signed in. (Services 15
 *   deletes the old `oxy_account_queries:*` keys once; this prefix is Inbox's.)
 * - Queries written by another build are dropped on restore; queued (paused)
 *   mutations are kept (`persistedQueryCache.ts`).
 * - On a subject change the account's queries, memory-only ones included, and
 *   its registered mutations are dropped from memory synchronously, before
 *   anyone is woken (`followOxyRuntime` activates it from the runtime's own
 *   notification). The leaving account's latest state is written first, a
 *   sign-out then deletes it, and only then is the next account's blob read.
 * - `isReadyFor(account)` is false until that account's blob is restored, and
 *   every private read waits on it (`useAccountCacheReady`), so another
 *   account's rows never render.
 *
 * Every storage operation runs through one queue, in order, and a restore
 * checks that its account is still the active one in the same tick it hydrates.
 */

import {
  hashKey,
  type Mutation,
  type Query,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import {
  getInboxBuildId,
  hydrateSnapshot,
  keepPersistedRootsInMemory,
  type PersistFilters,
  rootOf,
  snapshot,
  subscribeSnapshots,
} from './persistedQueryCache';

/** The key-value storage the cache writes its blobs to (AsyncStorage, localStorage). */
export interface StorageInterface {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

type QueryIdentity = { queryKey: QueryKey; meta?: Query['meta'] };

/** Inbox's declaration of which data is private to the signed-in account. */
export interface AccountQueriesConfig {
  /** Query-key roots (`queryKey[0]`) whose data belongs to the account and survives a restart. */
  roots: readonly string[];
  /**
   * Roots that belong to the account too, but must not be written to disk
   * (signed URLs, AI output, search results): dropped on a switch, never persisted.
   */
  memoryOnlyRoots?: readonly string[];
  /**
   * Mutation keys whose PAUSED (offline) instances replay after a restart for
   * the same account. Register their `mutationFn` with `setMutationDefaults`.
   */
  mutationKeys?: readonly QueryKey[];
  /**
   * Exact mutation keys whose records belong to the account but must remain in
   * memory. They are dropped on account transitions and never persisted. If
   * also listed in `mutationKeys`, memory-only takes precedence. This does not
   * cancel requests or callbacks.
   */
  memoryOnlyMutationKeys?: readonly QueryKey[];
  /**
   * Remove unregistered mutation records as well on every account transition.
   * Removing a record does not cancel an in-flight request or its callbacks.
   * Inbox leaves it off (docs/account-mutation-migration.md). Defaults to false.
   */
  clearUnregisteredMutations?: boolean;
}

/** Which queries and mutations an `AccountQueriesConfig` makes the account's. */
export interface AccountQueryOwnership {
  /** Dropped from memory on a subject change. */
  ownsQuery: (query: QueryIdentity) => boolean;
  /** Written to the account's blob. */
  persistsQuery: (query: QueryIdentity) => boolean;
  ownsMutation: (mutation: Mutation) => boolean;
  /** Whether a stored mutation key is owned by the account. */
  ownsMutationKey: (key: QueryKey | undefined) => boolean;
  /** Eligible for the account's persisted paused mutations. */
  persistsMutation: (mutation: Mutation) => boolean;
  /** Whether a stored mutation key belongs to this account's offline queue. */
  persistsMutationKey: (key: QueryKey | undefined) => boolean;
}

export function accountQueryOwnership(config: AccountQueriesConfig): AccountQueryOwnership {
  const memoryOnly = new Set(config.memoryOnlyRoots ?? []);
  const declared = new Set(config.roots);
  const memoryMutationHashes = new Set(
    (config.memoryOnlyMutationKeys ?? []).map((key) => hashKey(key)),
  );
  const mutationHashes = new Set((config.mutationKeys ?? []).map((key) => hashKey(key)));
  const isMemoryOnlyMutationKey = (key: QueryKey | undefined): boolean =>
    key !== undefined && memoryMutationHashes.has(hashKey(key));
  const persistsMutationKey = (key: QueryKey | undefined): boolean =>
    key !== undefined && !isMemoryOnlyMutationKey(key) && mutationHashes.has(hashKey(key));
  const ownsMutationKey = (key: QueryKey | undefined): boolean =>
    isMemoryOnlyMutationKey(key) || persistsMutationKey(key);

  const ownsQuery = (query: QueryIdentity): boolean => {
    const root = rootOf(query);
    return root !== null && (declared.has(root) || memoryOnly.has(root));
  };
  return {
    ownsQuery,
    persistsQuery: (query) => {
      const root = rootOf(query);
      return root !== null && declared.has(root) && !memoryOnly.has(root);
    },
    ownsMutation: (mutation) =>
      config.clearUnregisteredMutations === true || ownsMutationKey(mutation.options.mutationKey),
    ownsMutationKey,
    persistsMutation: (mutation) => persistsMutationKey(mutation.options.mutationKey),
    persistsMutationKey,
  };
}

/**
 * The storage key prefix. Deliberately not Services 14's `oxy_account_queries`
 * (Services 15 deletes every key under it once) nor `inbox_query_cache_`
 * (`utils/removeLegacyStorage.ts` deletes that one).
 */
export const ACCOUNT_QUERY_CACHE_KEY = 'inbox_account_queries';
const ACCOUNT_QUERY_CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
const ACCOUNT_QUERY_PERSIST_THROTTLE_MS = 1_000;

export interface AccountQueryPersistence {
  /** Storage became available (it initializes asynchronously). */
  setStorage(storage: StorageInterface): void;
  /** The signed-in account changed. `null` is a sign-out. Synchronous in-memory reset. */
  activate(accountId: string | null): void;
  /** The owning provider mounted: restore and persist the active account. */
  attach(): void;
  /** The owning provider unmounted: stop touching the client and storage. */
  detach(): void;
  /** True once the active account's cache is restored (always true signed out). */
  isReady(): boolean;
  /**
   * True only when `accountId` is the active account and its cache is restored
   * (signed out: when nobody is active). A render that names the account it is
   * for can never read as ready for another one.
   */
  isReadyFor(accountId: string | null): boolean;
  /** Resolves once `isReady()`, or once the account it waited for is left. */
  whenReady(): Promise<void>;
  subscribe(listener: () => void): () => void;
}

export function accountQueryStorageKey(accountId: string): string {
  return `${ACCOUNT_QUERY_CACHE_KEY}:${encodeURIComponent(accountId)}`;
}

export function createAccountQueryPersistence(
  queryClient: QueryClient,
  config: AccountQueriesConfig,
): AccountQueryPersistence {
  const { ownsQuery, persistsQuery, ownsMutation, persistsMutation, persistsMutationKey } =
    accountQueryOwnership(config);
  // Only roots this cache writes to disk; a memory-only root keeps the default gcTime.
  const memoryOnly = new Set(config.memoryOnlyRoots ?? []);
  keepPersistedRootsInMemory(
    queryClient,
    config.roots.filter((root) => !memoryOnly.has(root)),
  );
  const buster = getInboxBuildId();
  const filters: PersistFilters = {
    persistsQuery,
    shouldDehydrateMutation: (mutation) => mutation.state.isPaused && persistsMutation(mutation),
    buster,
  };
  const listeners = new Set<() => void>();

  let resolveStorage: (storage: StorageInterface) => void = () => undefined;
  const storageReady = new Promise<StorageInterface>((resolve) => {
    resolveStorage = resolve;
  });
  let hasStorage = false;
  // Every read, write and delete runs here, in order, once storage exists.
  let io: Promise<unknown> = storageReady;
  const enqueue = (operation: (storage: StorageInterface) => Promise<unknown> | unknown) => {
    io = io
      .then(() => storageReady)
      .then(operation)
      .catch(() => undefined);
  };

  let attached = false;
  let accountId: string | null = null;
  let restoredFor: string | null = null;
  let generation = 0;
  let writer: ReturnType<typeof subscribeSnapshots> | null = null;

  const notify = () => {
    for (const listener of [...listeners]) listener();
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const isReady = () => accountId === null || restoredFor === accountId;

  const dropScopedData = () => {
    queryClient.removeQueries({ predicate: ownsQuery });
    const mutations = queryClient.getMutationCache();
    for (const mutation of mutations.getAll()) {
      if (ownsMutation(mutation)) mutations.remove(mutation);
    }
  };

  const stopWriting = () => {
    writer?.unsubscribe();
    writer = null;
  };

  const restore = () => {
    const id = accountId;
    if (!attached || id === null) return;
    const current = generation;
    const key = accountQueryStorageKey(id);
    enqueue(async (storage) => {
      // An unreadable blob restores nothing; it must not leave the account unready.
      const raw = await storage.getItem(key).catch(() => null);
      // Same tick as the hydrate: a switch in between cannot be missed.
      if (current !== generation) return;
      if (
        !hydrateSnapshot(queryClient, raw, ACCOUNT_QUERY_CACHE_MAX_AGE, {
          buster,
          shouldRestoreQuery: persistsQuery,
          shouldRestoreMutation: (mutation) => persistsMutationKey(mutation.mutationKey),
        }) &&
        raw
      ) {
        await storage.removeItem(key).catch(() => undefined);
        if (current !== generation) return;
      }
      restoredFor = id;
      writer = subscribeSnapshots(
        queryClient,
        filters,
        ACCOUNT_QUERY_PERSIST_THROTTLE_MS,
        (serialized) => {
          if (current !== generation) return;
          enqueue((target) => target.setItem(key, serialized));
        },
      );
      notify();
    });
  };

  return {
    setStorage(next) {
      if (hasStorage) return;
      hasStorage = true;
      resolveStorage(next);
    },

    activate(next) {
      if (next === accountId) return;
      const previous = accountId;
      // Keep the leaving account's latest state, but only once its own blob was
      // restored: before that, the cache holds none of it to write.
      if (previous !== null && restoredFor === previous) {
        const serialized = snapshot(queryClient, filters);
        const key = accountQueryStorageKey(previous);
        enqueue((storage) => storage.setItem(key, serialized));
      }
      generation += 1;
      stopWriting();
      dropScopedData();
      accountId = next;
      restoredFor = null;
      if (next === null && previous !== null) {
        const key = accountQueryStorageKey(previous);
        enqueue((storage) => storage.removeItem(key));
      }
      notify();
      restore();
    },

    attach() {
      if (attached) return;
      attached = true;
      restore();
    },

    detach() {
      if (!attached) return;
      attached = false;
      writer?.flush();
      generation += 1;
      stopWriting();
      restoredFor = null;
      notify();
    },

    isReady,

    isReadyFor(id) {
      return id === accountId && isReady();
    },

    whenReady() {
      const waitingFor = generation;
      const settled = () => isReady() || generation !== waitingFor;
      if (settled()) return Promise.resolve();
      return new Promise((resolve) => {
        const off = subscribe(() => {
          if (!settled()) return;
          off();
          resolve();
        });
      });
    },

    subscribe,
  };
}
