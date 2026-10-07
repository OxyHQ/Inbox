import {
  ScrollRestorationProvider,
  type ScrollRouterAdapter,
} from '@oxy.so/bloom/scroll';
import { expoRouterScrollAdapter } from '@oxy.so/bloom/scroll/expo-router';
import type { ReactNode } from 'react';

// A mailbox can live outside the route navigator (desktop) or inside it
// (narrow screens). Its account/folder/search key, supplied by the list, is the
// content identity in both locations; the focused detail route is not.
const mailScrollAdapter: ScrollRouterAdapter = {
  useScreenContentId: () => 'mail-workspace',
  useScreenFocusEffect: expoRouterScrollAdapter.useScreenFocusEffect,
};

export function MailScrollProvider({ children }: { children: ReactNode }) {
  return (
    <ScrollRestorationProvider adapter={mailScrollAdapter}>
      {children}
    </ScrollRestorationProvider>
  );
}
