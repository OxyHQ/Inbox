import { useEffect } from 'react';
import {
  installForegroundNotificationHandler,
  type ForegroundPresentation,
} from '@oxy.so/services/notifications';

import { useEmailStore } from '@/hooks/useEmail';
import { emailMailboxIdFromPush, emailMessageIdFromPush } from '@/lib/notifications/email-push';
import {
  claimNewMailAnnouncement,
  isLookingAtMailbox,
} from '@/lib/notifications/new-mail-attention';

/**
 * Whether a push arriving while Inbox is open gets the OS banner.
 *
 * Not when the realtime socket already announced the same message with its
 * in-app toast (or deliberately stayed quiet about it) — that is the same mail,
 * and showing both was every new message twice. Not when the user is looking at
 * the folder it landed in either: the new row is the notification. Whichever
 * of the push and the socket event arrives first claims the message.
 */
export function foregroundPresentationForPush(data: unknown): ForegroundPresentation {
  const messageId = emailMessageIdFromPush(data);
  if (messageId === null) return 'suppress';
  if (!claimNewMailAnnouncement(messageId)) return 'suppress';
  const { viewMode } = useEmailStore.getState();
  if (isLookingAtMailbox(viewMode, emailMailboxIdFromPush(data))) return 'suppress';
  return 'show';
}

/**
 * Show new-mail notifications while Inbox is open.
 *
 * `expo-notifications` suppresses foreground banners by default. Without this
 * handler, the one moment the user is actively reading mail is the one moment a
 * new message produces no visible signal.
 */
export function useForegroundNotificationHandler(): void {
  useEffect(() => {
    void installForegroundNotificationHandler(foregroundPresentationForPush);
  }, []);
}
