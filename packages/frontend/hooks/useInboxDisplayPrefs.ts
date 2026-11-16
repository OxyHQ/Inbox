/**
 * Typed selector for the message-list *display* preferences.
 *
 * Components that only care about how the list looks (`MessageRow`,
 * `InboxList`) consume this instead of the full `useInboxPrefs` context, so
 * they don't reach into swipe/AI/notification prefs they don't use.
 *
 * Native loads persisted prefs asynchronously; until the load resolves
 * (`loaded === false`) we return the display defaults rather than risk a
 * one-frame flash of persisted-but-not-yet-applied preferences. Web choices load
 * synchronously; the provider still publishes the default SSR snapshot until
 * hydration completes.
 */

import { useMemo } from 'react';
import { Platform } from 'react-native';
import { useInboxPrefs } from '@/contexts/inbox-prefs-context';

export interface InboxDisplayPrefs {
  showPreviews: boolean;
  conversationView: boolean;
}

const DEFAULT_DISPLAY_PREFS: InboxDisplayPrefs = {
  showPreviews: true,
  conversationView: true,
};

export function useInboxDisplayPrefs(): InboxDisplayPrefs {
  const { prefs, loaded } = useInboxPrefs();

  return useMemo(() => {
    if (Platform.OS !== 'web' && !loaded) {
      return DEFAULT_DISPLAY_PREFS;
    }
    return {
      showPreviews: prefs.showPreviews,
      conversationView: prefs.conversationView,
    };
  }, [prefs.showPreviews, prefs.conversationView, loaded]);
}
