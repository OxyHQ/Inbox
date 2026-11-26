/**
 * Inbox's account cache: the one `AccountQueryPersistence` over the app's
 * `queryClient`, following the session Services' runtime owns.
 *
 * Services 15 opens each account's `@oxy.so/bloom-data` store on the runtime's
 * subject change, between committing the new bearer and waking anybody, and
 * keeps no React Query cache. Inbox's mail lives in React Query, so this does
 * the same for it: `followOxyRuntime` activates the cache from the runtime's own
 * notification, which runs before React renders anything for the new account,
 * and the private reads wait on `isReadyFor(<the account they render for>)`,
 * which no other account can satisfy.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  type AccountQueryPersistence,
  createAccountQueryPersistence,
  type StorageInterface,
} from '@/hooks/queries/accountQueryPersistence';
import { INBOX_ACCOUNT_QUERIES, queryClient } from '@/hooks/queries/queryClient';

/** The runtime surface the cache follows (`useOxyRuntime()` from `@oxy.so/services/runtime`). */
export interface SubjectSource {
  getSnapshot(): { account: { id?: string | null } | null };
  subscribe(listener: () => void): () => void;
}

/** In-memory storage: a device or tab with none still gets a working, unpersisted cache. */
export function createMemoryStorage(): StorageInterface {
  const values = new Map<string, string>();
  return {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
    removeItem: async (key) => {
      values.delete(key);
    },
  };
}

/** localStorage on the web, AsyncStorage on a device: where Services 14 kept these blobs. */
export function createPlatformStorage(): StorageInterface {
  if (Platform.OS === 'web') {
    const local = typeof window === 'undefined' ? undefined : window.localStorage;
    if (!local) return createMemoryStorage();
    return {
      getItem: async (key) => local.getItem(key),
      setItem: async (key, value) => local.setItem(key, value),
      removeItem: async (key) => local.removeItem(key),
    };
  }
  return {
    getItem: (key) => AsyncStorage.getItem(key),
    setItem: (key, value) => AsyncStorage.setItem(key, value),
    removeItem: (key) => AsyncStorage.removeItem(key),
  };
}

/**
 * Keep `cache` on the runtime's subject: activated now, and again from the
 * runtime's notification on every change, synchronously, before any component
 * woken by it renders. Returns the disposer (the provider unmounting).
 */
export function followOxyRuntime(
  cache: AccountQueryPersistence,
  runtime: SubjectSource,
  storage: StorageInterface = createPlatformStorage(),
): () => void {
  cache.setStorage(storage);
  const sync = () => cache.activate(runtime.getSnapshot().account?.id ?? null);
  const unsubscribe = runtime.subscribe(sync);
  sync();
  cache.attach();
  return () => {
    unsubscribe();
    cache.detach();
  };
}

/** The app's account cache (`app/_layout.tsx` mounts `InboxAccountCache` to drive it). */
export const inboxAccountCache = createAccountQueryPersistence(queryClient, INBOX_ACCOUNT_QUERIES);
