/**
 * Real-time inbox events.
 *
 * Subscribes to the API's `email:*` events and folds them into the existing
 * react-query caches, so new mail appears in the open list and the mailbox
 * badges update without a follow-up HTTP fetch.
 *
 * ## Why this does not open a socket
 *
 * It used to. `io(baseURL, …)` here was a SECOND authenticated Socket.IO
 * connection alongside the one `SessionClient` already maintains in
 * `@oxy.so/core`, and it was gated on `activeSessionId` being non-null:
 *
 *     if (!userId || !activeSessionId || !canUsePrivateApi || !baseURL) return;
 *
 * `activeSessionIdOf` returns null whenever the device-session state has not
 * loaded or the bound account carries no `sessionId` row on this device —
 * independently of holding a valid bearer. Nothing else in this app requires
 * it; `app/_layout.tsx` even writes `activeSessionId ?? user?.id ?? null`
 * precisely because it knows the value can be absent while signed in. So on the
 * web the socket was frequently never created at all, silently: the only
 * diagnostics were `__DEV__` console warnings, and `recordInboxMetric` reported
 * to a `CustomEvent` nobody listens to. New mail then waited for the 60 s poll
 * or a reload.
 *
 * `useOxyEvent` rides the SDK's own connection, which is already authenticated,
 * already reconnects, already re-binds its listeners when the socket is
 * recreated, and is gated on exactly the right thing. One connection per
 * client, and no gate of our own to get wrong.
 */

import { useCallback } from 'react';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { toast } from '@oxy.so/bloom';
import { useOxy, useOxyEvent } from '@oxy.so/services';

import { useEmailStore } from '@/hooks/useEmail';
import { emailKeys } from '@/hooks/queries/queryKeys';
import { useTranslation } from '@/lib/i18n';
import type { Mailbox, Message, Pagination } from '@/services/emailApi';
import { recordInboxMetric } from '@/utils/inboxTelemetry';

/**
 * Server → client payload contracts. These mirror
 * `packages/api/src/types/socketEvents.ts` exactly — both sides MUST change
 * together.
 */
export interface EmailNewEvent {
  /** The stored row's primary key. Stable, and what dedupe compares. */
  id: string;
  /** The RFC 5322 `Message-Id` header. NOT the row id; see below. */
  messageId: string;
  mailboxId: string;
  folder: string;
  from: { name?: string; address: string };
  subject: string;
  snippet: string;
  receivedAt: string;
  unread: true;
}

export interface EmailUnreadCountEvent {
  mailboxId: string;
  unread: number;
}

export type EmailChangedReason = 'flags' | 'labels' | 'moved' | 'deleted' | 'sent';

export interface EmailChangedEvent {
  id: string;
  mailboxIds: string[];
  reason: EmailChangedReason;
}

interface MessagesPage {
  data: Message[];
  pagination: Pagination;
}

type MessagesInfinite = InfiniteData<MessagesPage>;

/**
 * Build a Message-shaped placeholder from an `EmailNewEvent` so the optimistic
 * prepend renders correctly until the reconciling refetch lands.
 *
 * The placeholder MUST satisfy `Message` (zod-inferred) at the type level —
 * every required field gets a safe default. `_id` carries the REAL row id, so
 * the placeholder and the persisted row are the same identity and the dedupe
 * below can actually match. The previous version namespaced it
 * (`optimistic:${…}`) and deduped on `messageId`, which the server was filling
 * with the row id — so a real row's `<…@oxy.so>` header never matched and every
 * new mail rendered twice.
 */
function buildOptimisticMessage(event: EmailNewEvent, userId: string): Message {
  return {
    _id: event.id,
    userId,
    mailboxId: event.mailboxId,
    messageId: event.messageId,
    threadId: event.messageId,
    from: event.from,
    to: [],
    subject: event.subject,
    text: event.snippet,
    html: null,
    attachments: [],
    flags: {
      seen: false,
      starred: false,
      answered: false,
      forwarded: false,
      draft: false,
      pinned: false,
    },
    labels: [],
    draftRevision: 1,
    size: 0,
    date: event.receivedAt,
    receivedAt: event.receivedAt,
  };
}

/** Every cached `['messages', mailboxId, …, userId]` list for this mailbox. */
function messagesInMailbox(mailboxId: string, userId: string) {
  return {
    // The key shape is ['messages', mailboxId, starred, label, userId]. Matching
    // by predicate lands the write in every active variant. `email:new` carries
    // only the mailbox id, so starred/label cohorts reconcile via the
    // invalidate rather than the optimistic prepend.
    predicate: (q: { queryKey: readonly unknown[] }) => {
      const key = q.queryKey;
      return (
        Array.isArray(key) &&
        key[0] === 'messages' &&
        key[1] === mailboxId &&
        key[4] === userId
      );
    },
  };
}

function prependToMessageCache(
  queryClient: ReturnType<typeof useQueryClient>,
  mailboxId: string,
  userId: string,
  optimistic: Message,
) {
  queryClient.setQueriesData<MessagesInfinite>(
    messagesInMailbox(mailboxId, userId),
    (old) => {
      if (!old || old.pages.length === 0) return old;
      const alreadyPresent = old.pages.some((page) =>
        page.data.some((m) => m._id === optimistic._id),
      );
      if (alreadyPresent) return old;
      const [firstPage, ...rest] = old.pages;
      return {
        ...old,
        pages: [{ ...firstPage, data: [optimistic, ...firstPage.data] }, ...rest],
      };
    },
  );
}

/** Set a mailbox's unread badge from the server's authoritative count. */
function updateMailboxUnread(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string,
  mailboxId: string,
  unread: number,
) {
  queryClient.setQueryData<Mailbox[] | undefined>(emailKeys.mailboxes.list(userId), (old) => {
    if (!old) return old;
    let mutated = false;
    const next = old.map((mb) => {
      if (mb._id !== mailboxId) return mb;
      if (mb.unseenMessages === unread) return mb;
      mutated = true;
      return { ...mb, unseenMessages: unread };
    });
    return mutated ? next : old;
  });
}

const isEmailNewEvent = (value: unknown): value is EmailNewEvent => {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const from = v.from as Record<string, unknown> | undefined;
  return (
    typeof v.id === 'string' &&
    typeof v.messageId === 'string' &&
    typeof v.mailboxId === 'string' &&
    typeof v.folder === 'string' &&
    typeof v.subject === 'string' &&
    typeof v.snippet === 'string' &&
    typeof v.receivedAt === 'string' &&
    typeof from === 'object' &&
    from !== null &&
    typeof from.address === 'string'
  );
};

const isEmailUnreadCountEvent = (value: unknown): value is EmailUnreadCountEvent => {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.mailboxId === 'string' && typeof v.unread === 'number';
};

const isEmailChangedEvent = (value: unknown): value is EmailChangedEvent => {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    Array.isArray(v.mailboxIds) &&
    v.mailboxIds.every((id) => typeof id === 'string') &&
    typeof v.reason === 'string'
  );
};

/**
 * Subscribe to inbox realtime events. A no-op until a user is signed in; the
 * SDK's socket owns its own lifecycle, so there is nothing here to tear down.
 */
export function useInboxSocket() {
  const { user } = useOxy();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const viewMode = useEmailStore((s) => s.viewMode);
  const userId = user?.id ?? null;

  const onEmailNew = useCallback(
    (payload: unknown) => {
      if (!userId) return;
      if (!isEmailNewEvent(payload)) {
        recordInboxMetric('realtime_malformed_event');
        return;
      }

      // 1. Optimistic prepend — instant, no round-trip.
      prependToMessageCache(queryClient, payload.mailboxId, userId, buildOptimisticMessage(payload, userId));

      // 2. Bump the badge by one; the `email:unread_count` the server emits
      //    alongside reconciles the exact number a moment later.
      queryClient.setQueryData<Mailbox[] | undefined>(emailKeys.mailboxes.list(userId), (old) => {
        if (!old) return old;
        let mutated = false;
        const next = old.map((mb) => {
          if (mb._id !== payload.mailboxId) return mb;
          mutated = true;
          return { ...mb, unseenMessages: mb.unseenMessages + 1 };
        });
        return mutated ? next : old;
      });

      // 3. Reconcile: replace the placeholder with the real, fully-typed row.
      void queryClient.invalidateQueries(messagesInMailbox(payload.mailboxId, userId));

      // 4. Toast only when the user is looking somewhere else. When they are
      //    already on the folder it landed in, the new row IS the notification.
      const isViewingTargetMailbox =
        viewMode?.type === 'mailbox' && viewMode.mailbox._id === payload.mailboxId;
      if (!isViewingTargetMailbox) {
        toast.info(t('inbox.toast.newEmail', { sender: payload.from.name ?? payload.from.address }));
      }

      recordInboxMetric('realtime_email_new');
    },
    [queryClient, t, userId, viewMode],
  );

  const onUnreadCount = useCallback(
    (payload: unknown) => {
      if (!userId) return;
      if (!isEmailUnreadCountEvent(payload)) {
        recordInboxMetric('realtime_malformed_event');
        return;
      }
      updateMailboxUnread(queryClient, userId, payload.mailboxId, payload.unread);
    },
    [queryClient, userId],
  );

  /**
   * A message this client already holds changed somewhere else — another
   * device, or a server-side filter. The event carries no body on purpose:
   * invalidate and re-read through the ordinary authorised path.
   */
  const onEmailChanged = useCallback(
    (payload: unknown) => {
      if (!userId) return;
      if (!isEmailChangedEvent(payload)) {
        recordInboxMetric('realtime_malformed_event');
        return;
      }
      for (const mailboxId of payload.mailboxIds) {
        void queryClient.invalidateQueries(messagesInMailbox(mailboxId, userId));
      }
      // A move or a delete changes which threads exist, and `sent` adds a row
      // to a mailbox the user may not be viewing.
      void queryClient.invalidateQueries({ queryKey: emailKeys.mailboxes.root });
      recordInboxMetric('realtime_email_changed');
    },
    [queryClient, userId],
  );

  useOxyEvent('email:new', onEmailNew);
  useOxyEvent('email:unread_count', onUnreadCount);
  useOxyEvent('email:changed', onEmailChanged);
}
