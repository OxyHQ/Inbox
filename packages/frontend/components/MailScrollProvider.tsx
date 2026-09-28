import {
  ScrollRestorationProvider,
  type ScrollRouterAdapter,
} from '@oxy.so/bloom/scroll';
import { useEffect, type ReactNode } from 'react';

// A mailbox can live outside the route navigator (desktop) or inside it
// (narrow screens). Its account/folder/search key, supplied by the list, is the
// content identity in both locations; the focused detail route is not.
const mailScrollAdapter: ScrollRouterAdapter = {
  useScreenContentId: () => 'mail-workspace',
  useScreenFocusEffect: (effect) => useEffect(effect, [effect]),
};

export function MailScrollProvider({ children }: { children: ReactNode }) {
  return (
    <ScrollRestorationProvider adapter={mailScrollAdapter}>
      {children}
    </ScrollRestorationProvider>
  );
}
