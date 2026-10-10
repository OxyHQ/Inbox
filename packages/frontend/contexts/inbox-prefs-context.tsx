/**
 * Inbox client-side preferences.
 *
 * Stores user preferences that are scoped to this device (density, swipe
 * action bindings, AI feature toggles, notification preferences). Server-
 * backed preferences (signature, vacation responder, forwarding) live in
 * the email settings API and are not duplicated here.
 *
 * Persistence: localStorage on web, AsyncStorage on native. Only what the user
 * chose is stored; everything else follows the defaults below. The values are
 * loaded synchronously on web (no flash) and asynchronously on native
 * (defaults are used until the load resolves).
 */

import type { MailDensity } from '@oxy.so/bloom/mail-list';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';

/**
 * Bloom's row densities. Bloom 5 dropped `cozy`; a stored `cozy` falls back to
 * the default (`comfortable`) through `mergeInboxPrefs`.
 */
export type MessageDensity = MailDensity;
export type SwipeAction = 'archive' | 'delete' | 'mark-read' | 'snooze' | 'none';

export interface InboxPrefs {
  /** How tightly to pack message rows in the list. */
  density: MessageDensity;
  /** Group messages into threads in the list view. */
  conversationView: boolean;
  /** Auto-mark messages as read when opened. */
  markReadOnOpen: boolean;
  /** Show senders' avatars in the list. */
  /** Show message previews (snippets) in the list. */
  showPreviews: boolean;

  /** Action triggered by a left-to-right swipe in the list. */
  leftSwipeAction: SwipeAction;
  /** Action triggered by a right-to-left swipe in the list. */
  rightSwipeAction: SwipeAction;

  /** Enable push notifications. */
  pushNotifications: boolean;

  /** Enable Inbox's bounded daily brief feature. */
  aiBrief: boolean;
  /** Enable Smart Reply suggestions. */
  aiSmartReply: boolean;
  /** Offer an on-demand AI summary of the open conversation. */
  aiThreadSummary: boolean;
  /** Enable automatic categorization of messages. */
  aiCategorization: boolean;
}

export const DEFAULT_INBOX_PREFS: InboxPrefs = {
  density: 'comfortable',
  conversationView: true,
  markReadOnOpen: true,
  showPreviews: true,
  leftSwipeAction: 'archive',
  rightSwipeAction: 'delete',
  pushNotifications: true,
  // Only offers a button: nothing is sent until the brief is opened.
  aiBrief: true,
  aiSmartReply: true,
  // Only offers a button: nothing is summarized until the user asks.
  aiThreadSummary: true,
  aiCategorization: true,
};

/** What the user chose. A preference left out follows its default. */
export type InboxPrefChoices = Partial<InboxPrefs>;

function isMessageDensity(value: unknown): value is MessageDensity {
  return value === 'compact' || value === 'comfortable';
}

function isSwipeAction(value: unknown): value is SwipeAction {
  return (
    value === 'archive' ||
    value === 'delete' ||
    value === 'mark-read' ||
    value === 'snooze' ||
    value === 'none'
  );
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

const IS_VALID: { [K in keyof InboxPrefs]: (value: unknown) => value is InboxPrefs[K] } = {
  density: isMessageDensity,
  conversationView: isBoolean,
  markReadOnOpen: isBoolean,
  showPreviews: isBoolean,
  leftSwipeAction: isSwipeAction,
  rightSwipeAction: isSwipeAction,
  pushNotifications: isBoolean,
  aiBrief: isBoolean,
  aiSmartReply: isBoolean,
  aiThreadSummary: isBoolean,
  aiCategorization: isBoolean,
};

/** The well-formed choices in a persisted blob; stale or malformed values are dropped. */
export function readInboxPrefChoices(value: unknown): InboxPrefChoices {
  const stored = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const choices: Record<string, unknown> = {};
  for (const key of Object.keys(IS_VALID) as (keyof InboxPrefs)[]) {
    if (IS_VALID[key](stored[key])) choices[key] = stored[key];
  }
  return choices as InboxPrefChoices;
}

/** Merge persisted data without allowing stale or malformed values into the UI. */
export function mergeInboxPrefs(value: unknown): InboxPrefs {
  return { ...DEFAULT_INBOX_PREFS, ...readInboxPrefChoices(value) };
}

/**
 * The v2 blob saved every preference, defaults included, so its values are not
 * all choices. A value equal to today's default is dropped, so it keeps
 * following the default. `aiBrief` is dropped outright: it was off by default
 * then, and a saved `false` cannot tell that default from a choice.
 */
export function migrateV2InboxPrefs(value: unknown): InboxPrefChoices {
  const { aiBrief: _offByOldDefault, ...choices } = readInboxPrefChoices(value);
  return Object.fromEntries(
    Object.entries(choices).filter(
      ([key, choice]) => DEFAULT_INBOX_PREFS[key as keyof InboxPrefs] !== choice,
    ),
  ) as InboxPrefChoices;
}

interface InboxPrefsContextValue {
  prefs: InboxPrefs;
  setPref: <K extends keyof InboxPrefs>(key: K, value: InboxPrefs[K]) => void;
  /** True after persisted values have been loaded (always true on web). */
  loaded: boolean;
}

const LEGACY_STORAGE_KEY = 'inbox_user_prefs_v1';
const V2_STORAGE_KEY_PREFIX = 'inbox_user_prefs_v2';
// v3 holds only what the user chose, so a changed default reaches everyone.
const STORAGE_KEY_PREFIX = 'inbox_user_prefs_v3';
const InboxPrefsContext = createContext<InboxPrefsContextValue | undefined>(undefined);

export function getInboxPrefsStorageKey(scope: string | null = null): string {
  return `${STORAGE_KEY_PREFIX}:${encodeURIComponent(scope ?? 'anonymous')}`;
}

export function getV2InboxPrefsStorageKey(scope: string | null = null): string {
  return `${V2_STORAGE_KEY_PREFIX}:${encodeURIComponent(scope ?? 'anonymous')}`;
}

/** The v3 choices, or the v2 blob migrated when there are none yet. */
function parseStoredChoices(v3: string | null, v2: string | null): InboxPrefChoices {
  if (v3) return readInboxPrefChoices(JSON.parse(v3));
  if (v2) return migrateV2InboxPrefs(JSON.parse(v2));
  return {};
}

function loadSync(scope: string | null): InboxPrefChoices {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      return parseStoredChoices(
        window.localStorage.getItem(getInboxPrefsStorageKey(scope)),
        window.localStorage.getItem(getV2InboxPrefsStorageKey(scope)),
      );
    } catch (err) {
      // Reading localStorage can throw in sandboxed/private contexts. Fall
      // back to defaults; a re-write on first update will recover.
      console.warn('[inbox-prefs] failed to load prefs', err);
    }
  }
  return {};
}

interface InboxPrefsProviderProps {
  children: ReactNode;
  /** Stable user scope; preferences never cross this boundary. */
  scope?: string | null;
}

export function InboxPrefsProvider({ children, scope = null }: InboxPrefsProviderProps) {
  const storageKey = getInboxPrefsStorageKey(scope);
  const [choices, setChoices] = useState<InboxPrefChoices>(() => loadSync(scope));
  const [loaded, setLoaded] = useState(Platform.OS === 'web');
  const prefs = useMemo(() => ({ ...DEFAULT_INBOX_PREFS, ...choices }), [choices]);

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
        const [v3, v2] = await Promise.all([
          AsyncStorage.getItem(storageKey),
          AsyncStorage.getItem(getV2InboxPrefsStorageKey(scope)),
        ]);
        if (cancelled) return;
        setChoices(parseStoredChoices(v3, v2));
      } catch (err) {
        console.warn('[inbox-prefs] failed to load prefs', err);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scope, storageKey]);

  // Persist the choices once loaded, so stored values are never overwritten
  // before the initial load resolves on native. The v2 blob goes once v3 holds
  // what was migrated from it.
  useEffect(() => {
    if (!loaded) return;
    const v2Key = getV2InboxPrefsStorageKey(scope);
    (async () => {
      try {
        if (Platform.OS === 'web') {
          window.localStorage?.setItem(storageKey, JSON.stringify(choices));
          window.localStorage?.removeItem(v2Key);
        } else {
          const AsyncStorage = await import('@react-native-async-storage/async-storage').then(
            (m) => m.default,
          );
          await AsyncStorage.setItem(storageKey, JSON.stringify(choices));
          await AsyncStorage.removeItem(v2Key);
        }
      } catch (err) {
        console.warn('[inbox-prefs] failed to persist prefs', err);
      }
    })();
  }, [choices, loaded, scope, storageKey]);

  const setPref = useCallback(<K extends keyof InboxPrefs>(key: K, value: InboxPrefs[K]) => {
    setChoices((curr) => ({ ...curr, [key]: value }));
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
