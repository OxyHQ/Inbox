/** Persisted light/dark mode. The colour is the Oxy account colour (`useAccountColor`), not state here. */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';

type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeContextType {
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'inbox_theme_preference';

function loadThemeSync(): ThemePreference {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
    } catch (err) {
      // localStorage access can throw in private mode / sandboxed iframes;
      // fall through to the default. No user-visible action required.
      console.warn('[theme-context] failed to read theme preference', err);
    }
  }
  return 'system';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themePreference, setThemePreference] = useState<ThemePreference>(loadThemeSync);
  const [isLoaded, setIsLoaded] = useState(Platform.OS === 'web');

  // Native: load the persisted mode from AsyncStorage
  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      try {
        const AsyncStorage = await import('@react-native-async-storage/async-storage').then(
          (m) => m.default,
        );
        const storedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (storedMode === 'light' || storedMode === 'dark' || storedMode === 'system') {
          setThemePreference(storedMode);
        }
      } catch (err) {
        console.warn('[theme-context] failed to load theme preference', err);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  // Persist mode preference changes
  useEffect(() => {
    if (!isLoaded) return;
    (async () => {
      try {
        if (Platform.OS === 'web') {
          window.localStorage?.setItem(THEME_STORAGE_KEY, themePreference);
        } else {
          const AsyncStorage = await import('@react-native-async-storage/async-storage').then(
            (m) => m.default,
          );
          await AsyncStorage.setItem(THEME_STORAGE_KEY, themePreference);
        }
      } catch (err) {
        console.warn('[theme-context] failed to persist theme preference', err);
      }
    })();
  }, [themePreference, isLoaded]);

  const handleSetPreference = useCallback((pref: ThemePreference) => {
    setThemePreference(pref);
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        themePreference,
        setThemePreference: handleSetPreference,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

/** Read the persisted theme preferences. */
export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
}
