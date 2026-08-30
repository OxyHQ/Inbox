/**
 * Inbox QueryClient — offline-first + cross-restart persistence.
 *
 * - `networkMode: 'offlineFirst'` on queries serves cached data immediately and
 *   refetches in the background; on the critical message mutations (star, read,
 *   archive, delete — see `useMessageMutations`) it queues the mutation while
 *   offline and auto-resumes it when connectivity returns.
 * - `persistQueryClient(...)` dehydrates a whitelist of email queries and
 *   paused critical mutations to the active scope's storage.
 * - `onlineManager` resume hook replays paused mutations the instant the network
 *   is reported back (network monitoring itself is wired by `OxyProvider`).
 *
 * Storage layer:
 * - Web    → `localStorage` via `createSyncStoragePersister`.
 * - Native → `AsyncStorage` via `createAsyncStoragePersister`.
 *
 * Isolation: query hashes and persistence storage are both scoped to the
 * active Oxy account/session. Hydration starts only after the SDK has resolved
 * that scope; there is no device-wide private-mail blob to restore blindly.
 * Paused mutations carry only serializable variables. Their replay functions
 * resolve the current SDK API at execution time, so no bearer or CSRF header
 * is ever persisted.
 */

import { Platform } from 'react-native';
import { QueryClient, hashKey, onlineManager, type Query, type Mutation, type QueryKey } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Persister } from '@tanstack/react-query-persist-client';
import { useEmailStore } from '@/hooks/useEmail';

import {
  getInboxQueryScope,
  PERSISTED_QUERY_ROOTS,
  setInboxQueryScope,
} from '@/hooks/queries/queryKeys';

const CACHE_KEY_PREFIX = 'inbox_query_cache_v2';
const LEGACY_CACHE_KEY = 'inbox_query_cache_v1';
const CACHE_BUSTER = 'inbox-scoped-v3';
const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
const PERSIST_THROTTLE_MS = 1_000;

/**
 * React Query's visible query keys retain their legacy prefix shapes, while
 * this hash makes every key distinct for the active private-data scope.
 */
export function hashInboxQueryKey(queryKey: QueryKey): string {
  return hashKey([getInboxQueryScope(), queryKey]);
}

export const INBOX_MUTATION_KEYS = {
  toggleStar: ['inbox', 'message', 'toggle-star'] as const,
  toggleRead: ['inbox', 'message', 'toggle-read'] as const,
  archive: ['inbox', 'message', 'archive'] as const,
  delete: ['inbox', 'message', 'delete'] as const,
};

const PERSISTED_MUTATION_KEYS = new Set([
  hashKey(INBOX_MUTATION_KEYS.toggleStar),
  hashKey(INBOX_MUTATION_KEYS.toggleRead),
  hashKey(INBOX_MUTATION_KEYS.archive),
  hashKey(INBOX_MUTATION_KEYS.delete),
]);

interface ToggleStarVariables {
  messageId: string;
  starred: boolean;
}

interface ToggleReadVariables {
  messageId: string;
  seen: boolean;
}

interface ArchiveVariables {
  messageId: string;
  archiveMailboxId: string;
}

interface DeleteVariables {
  messageId: string;
  trashMailboxId?: string;
  isInTrash: boolean;
}

function activeEmailApi() {
  const api = useEmailStore.getState()._api;
  if (!api) throw new Error('Email API not initialized');
  return api;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 2,
      refetchOnWindowFocus: true,
      // Refetch stale data once the network is reported back.
      refetchOnReconnect: true,
      // Offline-first: serve cached data immediately, refetch in the background.
      networkMode: 'offlineFirst',
      queryKeyHashFn: hashInboxQueryKey,
    },
    mutations: {
      // Offline-first: pause and queue mutations when offline (see useMessageMutations).
      networkMode: 'offlineFirst',
      retry: 1,
    },
  },
});

queryClient.setMutationDefaults<unknown, Error, ToggleStarVariables>(INBOX_MUTATION_KEYS.toggleStar, {
  networkMode: 'offlineFirst',
  mutationFn: async ({ messageId, starred }) => activeEmailApi().updateFlags(messageId, { starred }),
});
queryClient.setMutationDefaults<unknown, Error, ToggleReadVariables>(INBOX_MUTATION_KEYS.toggleRead, {
  networkMode: 'offlineFirst',
  mutationFn: async ({ messageId, seen }) => activeEmailApi().updateFlags(messageId, { seen }),
});
queryClient.setMutationDefaults<void, Error, ArchiveVariables>(INBOX_MUTATION_KEYS.archive, {
  networkMode: 'offlineFirst',
  mutationFn: async ({ messageId, archiveMailboxId }) => {
    await activeEmailApi().moveMessage(messageId, archiveMailboxId);
  },
});
queryClient.setMutationDefaults<void, Error, DeleteVariables>(INBOX_MUTATION_KEYS.delete, {
  networkMode: 'offlineFirst',
  mutationFn: async ({ messageId, trashMailboxId, isInTrash }) => {
    const api = activeEmailApi();
    if (isInTrash) await api.deleteMessage(messageId, true);
    else if (trashMailboxId) await api.moveMessage(messageId, trashMailboxId);
    else await api.deleteMessage(messageId);
  },
});

// Replay paused (offline) mutations the moment the network returns, but only
// after the SDK has created the active email API for the current account.
export function resumeInboxMutations(): void {
  if (onlineManager.isOnline() && useEmailStore.getState()._api) {
    void queryClient.getMutationCache().resumePausedMutations();
  }
}

onlineManager.subscribe((isOnline) => {
  if (isOnline) {
    resumeInboxMutations();
  }
});

/**
 * Only persist queries that (a) completed successfully and (b) belong to the
 * email-read whitelist. AI results and errors are never persisted.
 */
function shouldDehydrateQuery(query: Query): boolean {
  if (query.state.status !== 'success') return false;
  if (getInboxQueryScope() === null) return false;
  const head = query.queryKey[0];
  return typeof head === 'string' && PERSISTED_QUERY_ROOTS.has(head);
}

/**
 * Persist only paused mutations with a registered replay function. The
 * mutation defaults above resolve the current SDK API after hydration.
 */
function shouldDehydrateMutation(mutation: Mutation): boolean {
  const mutationKey = mutation.options.mutationKey;
  return mutation.state.isPaused &&
    mutationKey !== undefined &&
    PERSISTED_MUTATION_KEYS.has(hashKey(mutationKey));
}

/**
 * Build the platform-appropriate persister, or `null` when no storage is
 * available (e.g. during a Node static web export where `localStorage` is
 * undefined). Returning `null` makes persistence a safe no-op.
 */
function createInboxPersister(scope: string): Persister | null {
  const key = `${CACHE_KEY_PREFIX}:${encodeURIComponent(scope)}`;
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return createSyncStoragePersister({
      storage: window.localStorage,
      key,
      throttleTime: PERSIST_THROTTLE_MS,
    });
  }
  return createAsyncStoragePersister({
    storage: AsyncStorage,
    key,
    throttleTime: PERSIST_THROTTLE_MS,
  });
}

interface InboxPersistence {
  unsubscribe: () => void;
}

let inboxPersistence: InboxPersistence | null = null;
let latestRestore: Promise<void> = Promise.resolve();
let scopeActivation = 0;

function stopInboxPersistence(): void {
  inboxPersistence?.unsubscribe();
  inboxPersistence = null;
}

async function removeLegacyDeviceCache(): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(LEGACY_CACHE_KEY);
    }
    return;
  }

  await AsyncStorage.removeItem(LEGACY_CACHE_KEY).then(() => undefined, () => undefined);
}

function startInboxPersistence(scope: string): Promise<void> {
  const persister = createInboxPersister(scope);
  if (!persister) return Promise.resolve();

  const [unsubscribe, restored] = persistQueryClient({
    queryClient,
    persister,
    maxAge: CACHE_MAX_AGE,
    buster: CACHE_BUSTER,
    dehydrateOptions: {
      shouldDehydrateQuery,
      shouldDehydrateMutation,
    },
  });
  const settled = restored.catch(() => undefined);
  inboxPersistence = { unsubscribe };
  latestRestore = settled;
  return settled;
}

/**
 * Switch the QueryClient to an authenticated account/session scope, wait for
 * any previous hydration to finish while its old scope is still active, then
 * clear in-memory data before hydrating the new scope. The gate keeps private
 * UI hidden for this entire transition.
 */
export async function activateInboxQueryScope(scope: string | null, clearPrevious: boolean): Promise<void> {
  const activation = ++scopeActivation;
  const previousRestore = latestRestore;
  stopInboxPersistence();
  await previousRestore;

  if (activation !== scopeActivation) return;

  await removeLegacyDeviceCache();
  if (activation !== scopeActivation) return;
  if (clearPrevious) queryClient.clear();
  setInboxQueryScope(scope);

  if (scope === null) {
    latestRestore = Promise.resolve();
    return;
  }

  await startInboxPersistence(scope);
}

/**
 * Remove the persisted query blob for the active scope. Scope-specific storage
 * normally remains available for that same account's next offline start.
 */
export async function clearPersistedInboxCache(): Promise<void> {
  const scope = getInboxQueryScope();
  if (!scope) return;
  const persister = createInboxPersister(scope);
  if (!persister) return;
  await Promise.resolve(persister.removeClient()).then(() => undefined, () => undefined);
}
