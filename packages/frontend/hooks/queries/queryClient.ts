/**
 * Inbox QueryClient — offline-first.
 *
 * - `networkMode: 'offlineFirst'` on queries serves cached data immediately and
 *   refetches in the background; on the critical message mutations (star, read,
 *   archive, delete — see `useMessageMutations`) it queues the mutation while
 *   offline and auto-resumes it when connectivity returns.
 * - `onlineManager` resume hook replays paused mutations the instant the network
 *   is reported back. On a device React Query hears the network and the app's
 *   focus from bloom-data's `environment`, which `OxyProvider` feeds from NetInfo
 *   and AppState (`followDeviceEnvironment`); the browser feeds both on the web.
 *
 * This client is Inbox's own: Services 15 holds no React Query cache, so
 * `app/_layout.tsx` mounts it in a `QueryClientProvider` above `OxyProvider`.
 * Persistence and account isolation are Inbox's too (`inboxAccountCache.ts`):
 * `INBOX_ACCOUNT_QUERIES` is stored per account, discarded on every new build,
 * dropped from memory on an account switch and deleted on sign-out. Paused
 * mutations carry only serializable variables; their replay functions resolve
 * the current SDK API at execution time, so no bearer or CSRF header is ever
 * persisted.
 */

import { environment } from '@oxy.so/bloom-data';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';
import type { AccountQueriesConfig } from '@/hooks/queries/accountQueryPersistence';
import { useEmailStore } from '@/hooks/useEmail';
import type { MessageFlags } from '@/services/emailApi';
import { eachWithConcurrency, PER_MESSAGE_CONCURRENCY } from '@/utils/concurrency';

import {
  MEMORY_ONLY_QUERY_ROOTS,
  PERSISTED_QUERY_ROOTS,
  SAVED_SEARCH_MUTATION_KEYS,
} from '@/hooks/queries/queryKeys';

/**
 * For mutations that set state (a flag, a folder, a label set) and so may be
 * repeated safely: one retry, which is also what parks them while offline.
 */
export const RETRY_IDEMPOTENT = { retry: 1 } as const;

/**
 * Every message mutation that can wait offline (`RETRY_IDEMPOTENT`). Keyed, so
 * the account cache drops a waiting one when the account changes — unkeyed, it resumed
 * after the switch and ran under the new account's credentials — and replays
 * it after a restart for the same account.
 */
export const INBOX_MUTATION_KEYS = {
  toggleStar: ['inbox', 'message', 'toggle-star'] as const,
  toggleRead: ['inbox', 'message', 'toggle-read'] as const,
  archive: ['inbox', 'message', 'archive'] as const,
  delete: ['inbox', 'message', 'delete'] as const,
  togglePin: ['inbox', 'message', 'toggle-pin'] as const,
  updateLabels: ['inbox', 'message', 'labels'] as const,
  snooze: ['inbox', 'message', 'snooze'] as const,
  unsnooze: ['inbox', 'message', 'unsnooze'] as const,
  bulkFlags: ['inbox', 'messages', 'flags'] as const,
  bulkMove: ['inbox', 'messages', 'move'] as const,
};

/** Drafts and sends carry message content and must not persist as mutation records. */
export const INBOX_MEMORY_ONLY_MUTATION_KEYS = {
  saveDraft: ['inbox', 'draft', 'save'] as const,
  sendMessage: ['inbox', 'message', 'send'] as const,
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

interface TogglePinVariables {
  messageId: string;
  pinned: boolean;
}

interface UpdateLabelsVariables {
  messageId: string;
  add: string[];
  remove: string[];
}

interface SnoozeVariables {
  messageIds: string[];
  until: string;
}

interface BulkFlagsVariables {
  messageIds: string[];
  flags: Partial<MessageFlags>;
}

interface BulkMoveVariables {
  messageIds: string[];
  mailboxId: string;
}

function activeEmailApi() {
  const api = useEmailStore.getState()._api;
  if (!api) throw new Error('Email API not initialized');
  return api;
}

/**
 * Creates an Inbox client with the existing replay defaults. Those mutations use
 * the current global email API, so this factory does not isolate accounts.
 */
export function createInboxQueryClient(): QueryClient {
  const queryClient = new QueryClient({
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
        networkMode: 'offlineFirst',
        // No retry unless the mutation is safe to repeat. A retry re-sends a
        // request that may already have committed: a draft save that timed out
        // was saved twice (or answered 409 and forked), a create made two labels,
        // an unsubscribe mailed the sender twice. And with no retry there is
        // nothing to pause on while offline — a draft save or a send fails at once
        // instead of hanging until the network returns and then firing unasked.
        // The idempotent message actions opt in with `RETRY_IDEMPOTENT`, and are
        // queued offline and replayed when the network is back.
        retry: 0,
      },
    },
  });

  queryClient.setMutationDefaults<unknown, Error, ToggleStarVariables>(
    INBOX_MUTATION_KEYS.toggleStar,
    {
      networkMode: 'offlineFirst',
      ...RETRY_IDEMPOTENT,
      mutationFn: async ({ messageId, starred }) =>
        activeEmailApi().updateFlags(messageId, { starred }),
    },
  );
  queryClient.setMutationDefaults<unknown, Error, ToggleReadVariables>(
    INBOX_MUTATION_KEYS.toggleRead,
    {
      networkMode: 'offlineFirst',
      ...RETRY_IDEMPOTENT,
      mutationFn: async ({ messageId, seen }) => activeEmailApi().updateFlags(messageId, { seen }),
    },
  );
  queryClient.setMutationDefaults<void, Error, ArchiveVariables>(INBOX_MUTATION_KEYS.archive, {
    networkMode: 'offlineFirst',
    ...RETRY_IDEMPOTENT,
    mutationFn: async ({ messageId, archiveMailboxId }) => {
      await activeEmailApi().moveMessage(messageId, archiveMailboxId);
    },
  });
  queryClient.setMutationDefaults<void, Error, DeleteVariables>(INBOX_MUTATION_KEYS.delete, {
    networkMode: 'offlineFirst',
    ...RETRY_IDEMPOTENT,
    mutationFn: async ({ messageId, trashMailboxId, isInTrash }) => {
      const api = activeEmailApi();
      if (isInTrash) await api.deleteMessage(messageId, true);
      else if (trashMailboxId) await api.moveMessage(messageId, trashMailboxId);
      else await api.deleteMessage(messageId);
    },
  });

  queryClient.setMutationDefaults<unknown, Error, TogglePinVariables>(
    INBOX_MUTATION_KEYS.togglePin,
    {
      networkMode: 'offlineFirst',
      ...RETRY_IDEMPOTENT,
      mutationFn: async ({ messageId, pinned }) =>
        activeEmailApi().updateFlags(messageId, { pinned }),
    },
  );
  queryClient.setMutationDefaults<unknown, Error, UpdateLabelsVariables>(
    INBOX_MUTATION_KEYS.updateLabels,
    {
      networkMode: 'offlineFirst',
      ...RETRY_IDEMPOTENT,
      mutationFn: async ({ messageId, add, remove }) =>
        activeEmailApi().updateLabels(messageId, add, remove),
    },
  );
  queryClient.setMutationDefaults<void, Error, SnoozeVariables>(INBOX_MUTATION_KEYS.snooze, {
    networkMode: 'offlineFirst',
    ...RETRY_IDEMPOTENT,
    mutationFn: async ({ messageIds, until }) => {
      const api = activeEmailApi();
      await eachWithConcurrency(messageIds, PER_MESSAGE_CONCURRENCY, (id) =>
        api.snoozeMessage(id, until),
      );
    },
  });
  queryClient.setMutationDefaults<unknown, Error, { messageId: string }>(
    INBOX_MUTATION_KEYS.unsnooze,
    {
      networkMode: 'offlineFirst',
      ...RETRY_IDEMPOTENT,
      mutationFn: async ({ messageId }) => activeEmailApi().unsnoozeMessage(messageId),
    },
  );
  queryClient.setMutationDefaults<unknown, Error, BulkFlagsVariables>(
    INBOX_MUTATION_KEYS.bulkFlags,
    {
      networkMode: 'offlineFirst',
      ...RETRY_IDEMPOTENT,
      mutationFn: async ({ messageIds, flags }) =>
        activeEmailApi().bulkUpdateFlags(messageIds, flags),
    },
  );
  queryClient.setMutationDefaults<unknown, Error, BulkMoveVariables>(INBOX_MUTATION_KEYS.bulkMove, {
    networkMode: 'offlineFirst',
    ...RETRY_IDEMPOTENT,
    mutationFn: async ({ messageIds, mailboxId }) =>
      activeEmailApi().bulkMoveMessages(messageIds, mailboxId),
  });

  return queryClient;
}

export const queryClient = createInboxQueryClient();

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
 * On a device, React Query hears whether it is online and in front from
 * bloom-data's `environment`, which `OxyProvider` feeds from NetInfo and
 * AppState: Services 14 fed React Query's managers itself, Services 15 feeds
 * only `environment`. Without this a device never counts as offline, so an
 * offline star or archive fails instead of waiting for the network. The web
 * keeps React Query's own browser listeners (online/offline, visibility), which
 * only hear changes: a tab opened offline starts offline, as Services 14 made it.
 */
export function followDeviceEnvironment(): void {
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      onlineManager.setOnline(false);
    }
    return;
  }
  onlineManager.setEventListener((setOnline) => {
    setOnline(environment.online);
    return environment.subscribe((event) => {
      if (event === 'online' || event === 'offline') setOnline(event === 'online');
    });
  });
  focusManager.setEventListener((setFocused) => {
    setFocused(environment.focused);
    return environment.subscribe((event) => {
      if (event === 'focus' || event === 'blur') setFocused(event === 'focus');
    });
  });
}

/** Inbox's private, per-account data, persisted and isolated by `inboxAccountCache`. */
export const INBOX_ACCOUNT_QUERIES: AccountQueriesConfig = {
  roots: [...PERSISTED_QUERY_ROOTS],
  memoryOnlyRoots: [...MEMORY_ONLY_QUERY_ROOTS],
  mutationKeys: Object.values(INBOX_MUTATION_KEYS),
  memoryOnlyMutationKeys: [
    ...Object.values(INBOX_MEMORY_ONLY_MUTATION_KEYS),
    ...Object.values(SAVED_SEARCH_MUTATION_KEYS),
  ],
};
