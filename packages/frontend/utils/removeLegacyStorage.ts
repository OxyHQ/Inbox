/**
 * Delete what earlier Inbox builds persisted themselves. Nothing reads any of
 * it any more, and every piece is private, so leaving it in storage is not an
 * option:
 *
 * - the mail caches Inbox kept before `@oxy.so/services` 8.3 took persistence
 *   over (`accountQueries`) — an account's private mail;
 * - the raw-fetch offline queue that predates TanStack paused mutations
 *   (`hooks/queries/queryClient.ts`) — recorded requests, auth headers
 *   included. Offline writes replay through the SDK now, never from storage.
 *
 * Delete this file once those builds are long gone.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LEGACY_QUERY_CACHE_PREFIX = 'inbox_query_cache_';
const LEGACY_OFFLINE_QUEUE_KEY = 'inbox_offline_queue';
const LEGACY_OFFLINE_QUEUE_DATABASE = 'inbox-offline';

export async function removeLegacyStorage(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return;
      if (window.localStorage) {
        const keys = Object.keys(window.localStorage).filter(
          (key) => key.startsWith(LEGACY_QUERY_CACHE_PREFIX) || key === LEGACY_OFFLINE_QUEUE_KEY,
        );
        for (const key of keys) window.localStorage.removeItem(key);
      }
      // The offline queue only ever existed on web, in its own database.
      window.indexedDB?.deleteDatabase(LEGACY_OFFLINE_QUEUE_DATABASE);
      return;
    }
    const keys = (await AsyncStorage.getAllKeys()).filter((key) =>
      key.startsWith(LEGACY_QUERY_CACHE_PREFIX),
    );
    if (keys.length > 0) await AsyncStorage.multiRemove(keys);
  } catch {
    // Storage unavailable: nothing was persisted there either.
  }
}
