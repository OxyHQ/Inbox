/**
 * Inbox client-side preferences.
 *
 * Stores user preferences that are scoped to this device (density, swipe
 * action bindings, AI feature toggles, notification preferences). Server-
 * backed preferences (signature, vacation responder, forwarding) live in
 * the email settings API and are not duplicated here.
 *
 * Persistence: localStorage on web, AsyncStorage on native. The values are
 * loaded synchronously on web (no flash) and asynchronously on native
 * (defaults are used until the load resolves).
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';

export type MessageDensity = 'compact' | 'comfortable' | 'cozy';
export type SwipeAction = 'archive' | 'delete' | 'mark-read' | 'snooze' | 'none';

export interface InboxPrefs {
  /** How tightly to pack message rows in the list. */
  density: MessageDensity;
  /** Group messages into threads in the list view. */
  conversationView: boolean;
  /** Auto-mark messages as read when opened. */
  markReadOnOpen: boolean;
  /** Show senders' avatars in the list. */
  showAvatars: boolean;
  /** Show message previews (snippets) in the list. */
  showPreviews: boolean;

  /** Action triggered by a left-to-right swipe in the list. */
  leftSwipeAction: SwipeAction;
  /** Action triggered by a right-to-left swipe in the list. */
  rightSwipeAction: SwipeAction;

  /** Enable push notifications. */
  pushNotifications: boolean;
  /** Enable email-digest summary notifications. */
  emailDigest: boolean;
  /** Play a sound when a new message arrives. */
  notificationSound: boolean;

  /** Enable the Alia daily Brief feature. */
  aiBrief: boolean;
  /** Enable Smart Reply suggestions. */
  aiSmartReply: boolean;
  /** Enable automatic categorization of messages. */
  aiCategorization: boolean;
}

export const DEFAULT_INBOX_PREFS: InboxPrefs = {
  density: 'comfortable',
  conversationView: true,
  markReadOnOpen: true,
  showAvatars: true,
  showPreviews: true,
  leftSwipeAction: 'archive',
  rightSwipeAction: 'delete',
  pushNotifications: true,
  emailDigest: false,
  notificationSound: true,
  // The brief is an explicit opt-in and is collapsed even after enabling it.
  aiBrief: false,
  aiSmartReply: true,
  aiCategorization: true,
};

function isMessageDensity(value: unknown): value is MessageDensity {
  return value === 'compact' || value === 'comfortable' || value === 'cozy';
}

function isSwipeAction(value: unknown): value is SwipeAction {
  return value === 'archive' || value === 'delete' || value === 'mark-read' || value === 'snooze' || value === 'none';
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Merge persisted data without allowing stale or malformed values into the UI. */
export function mergeInboxPrefs(value: unknown): InboxPrefs {
  const stored = value && typeof value === 'object' ? value as Record<string, unknown> : {};

  return {
    density: isMessageDensity(stored.density) ? stored.density : DEFAULT_INBOX_PREFS.density,
    conversationView: readBoolean(stored.conversationView, DEFAULT_INBOX_PREFS.conversationView),
    markReadOnOpen: readBoolean(stored.markReadOnOpen, DEFAULT_INBOX_PREFS.markReadOnOpen),
    showAvatars: readBoolean(stored.showAvatars, DEFAULT_INBOX_PREFS.showAvatars),
    showPreviews: readBoolean(stored.showPreviews, DEFAULT_INBOX_PREFS.showPreviews),
    leftSwipeAction: isSwipeAction(stored.leftSwipeAction) ? stored.leftSwipeAction : DEFAULT_INBOX_PREFS.leftSwipeAction,
    rightSwipeAction: isSwipeAction(stored.rightSwipeAction) ? stored.rightSwipeAction : DEFAULT_INBOX_PREFS.rightSwipeAction,
    pushNotifications: readBoolean(stored.pushNotifications, DEFAULT_INBOX_PREFS.pushNotifications),
    emailDigest: readBoolean(stored.emailDigest, DEFAULT_INBOX_PREFS.emailDigest),
    notificationSound: readBoolean(stored.notificationSound, DEFAULT_INBOX_PREFS.notificationSound),
    aiBrief: readBoolean(stored.aiBrief, DEFAULT_INBOX_PREFS.aiBrief),
    aiSmartReply: readBoolean(stored.aiSmartReply, DEFAULT_INBOX_PREFS.aiSmartReply),
    aiCategorization: readBoolean(stored.aiCategorization, DEFAULT_INBOX_PREFS.aiCategorization),
  };
}

interface InboxPrefsContextValue {
  prefs: InboxPrefs;
  setPref: <K extends keyof InboxPrefs>(key: K, value: InboxPrefs[K]) => void;
  /** True after persisted values have been loaded (always true on web). */
  loaded: boolean;
}

const LEGACY_STORAGE_KEY = 'inbox_user_prefs_v1';
const STORAGE_KEY_PREFIX = 'inbox_user_prefs_v2';
const InboxPrefsContext = createContext<InboxPrefsContextValue | undefined>(undefined);

export function getInboxPrefsStorageKey(scope: string | null = null): string {
  return `${STORAGE_KEY_PREFIX}:${encodeURIComponent(scope ?? 'anonymous')}`;
}

function loadSync(storageKey: string): InboxPrefs {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        return mergeInboxPrefs(JSON.parse(stored));
      }
    } catch (err) {
      // Reading localStorage can throw in sandboxed/private contexts. Fall
      // back to defaults; a re-write on first update will recover.
      console.warn('[inbox-prefs] failed to load prefs', err);
    }
  }
  return mergeInboxPrefs(undefined);
}

interface InboxPrefsProviderProps {
  children: ReactNode;
  /** Stable user scope; preferences never cross this boundary. */
  scope?: string | null;
}

export function InboxPrefsProvider({ children, scope = null }: InboxPrefsProviderProps) {
  const storageKey = getInboxPrefsStorageKey(scope ?? null);
  const [prefs, setPrefs] = useState<InboxPrefs>(() => loadSync(storageKey));
  const [loaded, setLoaded] = useState(Platform.OS === 'web');

  // Delete the pre-scope device-wide blob. It is intentionally not migrated:
  // its owner is unknowable, so copying it into the first account would make
  // account separation implicit and surprising.
  useEffect(() => {
    try {
      if (Platform.OS === 'web') {
        window.localStorage?.removeItem(LEGACY_STORAGE_KEY);
      } else {
        void import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) =>
          AsyncStorage.removeItem(LEGACY_STORAGE_KEY),
        );
      }
    } catch (err) {
      // Storage cleanup is best effort.
      console.warn('[inbox-prefs] failed to remove legacy prefs', err);
    }
  }, []);

  // Native: hydrate from AsyncStorage.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let cancelled = false;
    (async () => {
      try {
        const AsyncStorage = await import('@react-native-async-storage/async-storage').then(
          (m) => m.default,
        );
        const stored = await AsyncStorage.getItem(storageKey);
        if (cancelled) return;
        if (stored) {
          setPrefs(mergeInboxPrefs(JSON.parse(stored)));
        }
      } catch (err) {
        console.warn('[inbox-prefs] failed to load prefs', err);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  // Persist on change once loaded so we don't overwrite stored values with
  // defaults before the initial load resolves on native.
  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        if (Platform.OS === 'web') {
          window.localStorage?.setItem(storageKey, JSON.stringify(prefs));
        } else {
          const AsyncStorage = await import('@react-native-async-storage/async-storage').then(
            (m) => m.default,
          );
          await AsyncStorage.setItem(storageKey, JSON.stringify(prefs));
        }
      } catch (err) {
        console.warn('[inbox-prefs] failed to persist prefs', err);
      }
    })();
  }, [prefs, loaded, storageKey]);

  const setPref = useCallback(<K extends keyof InboxPrefs>(key: K, value: InboxPrefs[K]) => {
    setPrefs((curr) => ({ ...curr, [key]: value }));
  }, []);

  return (
    <InboxPrefsContext.Provider value={{ prefs, setPref, loaded }}>
      {children}
    </InboxPrefsContext.Provider>
  );
}

export function useInboxPrefs(): InboxPrefsContextValue {
  const ctx = useContext(InboxPrefsContext);
  if (!ctx) {
    throw new Error('useInboxPrefs must be used within an InboxPrefsProvider');
  }
  return ctx;
}
