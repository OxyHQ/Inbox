/**
 * Delete the mail caches Inbox persisted itself before `@oxy.so/services` 8.3
 * took persistence over (`accountQueries`). Nothing reads them any more, but
 * each holds an account's private mail, so leaving them in storage is not an
 * option. Delete this file once those builds are long gone.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LEGACY_PREFIX = 'inbox_query_cache_';

export async function removeLegacyQueryCache(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const keys = Object.keys(window.localStorage).filter((key) => key.startsWith(LEGACY_PREFIX));
      for (const key of keys) window.localStorage.removeItem(key);
      return;
    }
    const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(LEGACY_PREFIX));
    if (keys.length > 0) await AsyncStorage.multiRemove(keys);
  } catch {
    // Storage unavailable: nothing was persisted there either.
  }
}
