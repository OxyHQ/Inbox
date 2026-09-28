/**
 * Inbox QueryClient — offline-first.
 *
 * - `networkMode: 'offlineFirst'` on queries serves cached data immediately and
 *   refetches in the background; on the critical message mutations (star, read,
 *   archive, delete — see `useMessageMutations`) it queues the mutation while
 *   offline and auto-resumes it when connectivity returns.
 * - `onlineManager` resume hook replays paused mutations the instant the network
 *   is reported back (network monitoring itself is wired by `OxyProvider`).
 *
 * Persistence and account isolation are the SDK's: `INBOX_ACCOUNT_QUERIES` is
 * handed to `OxyProvider`, which stores these roots per account, discards them
 * on every new build, drops them from memory on an account switch and deletes
 * them on sign-out. Paused mutations carry only serializable variables; their
 * replay functions resolve the current SDK API at execution time, so no bearer
 * or CSRF header is ever persisted.
 */

import { QueryClient, onlineManager } from '@tanstack/react-query';
import type { AccountQueriesConfig } from '@oxy.so/services';
import { useEmailStore } from '@/hooks/useEmail';

import { MEMORY_ONLY_QUERY_ROOTS, PERSISTED_QUERY_ROOTS } from '@/hooks/queries/queryKeys';

export const INBOX_MUTATION_KEYS = {
  toggleStar: ['inbox', 'message', 'toggle-star'] as const,
  toggleRead: ['inbox', 'message', 'toggle-read'] as const,
  archive: ['inbox', 'message', 'archive'] as const,
  delete: ['inbox', 'message', 'delete'] as const,
};

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

/** Inbox's private, per-account data, persisted and isolated by `OxyProvider`. */
export const INBOX_ACCOUNT_QUERIES: AccountQueriesConfig = {
  roots: [...PERSISTED_QUERY_ROOTS],
  memoryOnlyRoots: [...MEMORY_ONLY_QUERY_ROOTS],
  mutationKeys: Object.values(INBOX_MUTATION_KEYS),
};
