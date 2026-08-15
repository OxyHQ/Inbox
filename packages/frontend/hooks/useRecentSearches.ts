import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

const MAX_RECENT_SEARCHES = 6;
const STORAGE_PREFIX = 'inbox-recent-searches-v1:';

export function recentSearchesStorageKey(scope: string | null | undefined): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(scope ?? 'anonymous')}`;
}

export function mergeRecentSearches(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const unique: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const query = entry.trim();
    if (!query || unique.includes(query)) continue;
    unique.push(query);
    if (unique.length >= MAX_RECENT_SEARCHES) break;
  }
  return unique;
}

export function addRecentSearch(current: string[], query: string): string[] {
  return mergeRecentSearches([query, ...current]);
}

async function readStored(key: string): Promise<string[]> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return mergeRecentSearches(JSON.parse(window.localStorage.getItem(key) ?? '[]'));
    }
    const AsyncStorage = await import('@react-native-async-storage/async-storage').then((m) => m.default);
    return mergeRecentSearches(JSON.parse((await AsyncStorage.getItem(key)) ?? '[]'));
  } catch {
    return [];
  }
}

async function writeStored(key: string, value: string[]): Promise<void> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem(key, JSON.stringify(value));
      return;
    }
    const AsyncStorage = await import('@react-native-async-storage/async-storage').then((m) => m.default);
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Recent searches improve navigation but must never block searching.
  }
}

export function useRecentSearches(scope: string | null | undefined) {
  const key = recentSearchesStorageKey(scope);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void readStored(key).then((stored) => {
      if (!cancelled) setRecentSearches(stored);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const remember = useCallback((query: string) => {
    setRecentSearches((current) => {
      const next = addRecentSearch(current, query);
      void writeStored(key, next);
      return next;
    });
  }, [key]);

  const clear = useCallback(() => {
    setRecentSearches([]);
    void writeStored(key, []);
  }, [key]);

  return { recentSearches, remember, clear };
}
