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

import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { toast } from '@oxy.so/bloom/toast';
import { useOxy, useOxyEvent } from '@oxy.so/services/ui/client';
import { usePathname, useRouter } from 'expo-router';

import { SPECIAL_USE } from '@/constants/mailbox';
import { useEmailStore } from '@/hooks/useEmail';
import { invalidateChangedMail } from '@/hooks/queries/invalidateMailViews';
import { emailKeys } from '@/hooks/queries/queryKeys';
import { useTranslation } from '@/lib/i18n';
import {
  claimNewMailAnnouncement,
  isLookingAtMailbox,
  noteCurrentPath,
} from '@/lib/notifications/new-mail-attention';
import type { Mailbox, Message, ThreadData } from '@/services/emailApi';
import { findCachedMessage, type MessagesPage } from '@/utils/messageCache';
import { recordInboxMetric } from '@/utils/inboxTelemetry';
import { isOwnChange } from '@/utils/ownChanges';

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

/**
 * `delivery`: a message the user sent moved between sending, retrying,
 * delivered and not delivered. The event carries no state — re-read it.
 */
export type EmailChangedReason = 'flags' | 'labels' | 'moved' | 'deleted' | 'sent' | 'delivery';

export interface EmailChangedEvent {
  id: string;
  mailboxIds: string[];
  reason: EmailChangedReason;
}

type MessagesInfinite = InfiniteData<MessagesPage>;

/** How long a burst of `email:changed` events is gathered before one reconcile. */
const CHANGED_COALESCE_MS = 300;

/** Reasons that leave a message where it was: its folder and the counts are unchanged. */
const IN_PLACE_REASONS: ReadonlySet<EmailChangedReason> = new Set(['flags', 'labels', 'delivery']);

/** Reasons this client's own mutations cause, and so echo back to it. */
const OWN_REASONS: ReadonlySet<EmailChangedReason> = new Set([
  'flags',
  'labels',
  'moved',
  'deleted',
]);

/** How many `email:new` ids are remembered to recognise a repeat. */
const SEEN_NEW_MAIL_LIMIT = 500;

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
    id: event.id,
    userId,
    mailboxId: event.mailboxId,
    messageId: event.messageId,
    // A new row's thread is keyed by the smallest row id in its group; until
    // the refetch says otherwise, the row is its own thread.
    threadId: event.id,
    from: { name: event.from.name ?? '', address: event.from.address },
    to: [],
    cc: [],
    bcc: [],
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
    highlights: [],
    encrypted: false,
    spamScore: null,
    spamAction: null,
    inReplyTo: null,
    references: [],
    aliasTag: null,
    snoozedUntil: null,
    snoozedFromMailbox: null,
    scheduledAt: null,
    readReceiptRequested: false,
    readReceiptSent: false,
    draftRevision: 1,
    size: 0,
    date: event.receivedAt,
    receivedAt: event.receivedAt,
    createdAt: event.receivedAt,
    updatedAt: event.receivedAt,
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
        Array.isArray(key) && key[0] === 'messages' && key[1] === mailboxId && key[4] === userId
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
  queryClient.setQueriesData<MessagesInfinite>(messagesInMailbox(mailboxId, userId), (old) => {
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
  });
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
  const api = useEmailStore((s) => s._api);
  const router = useRouter();
  const userId = user?.id ?? null;
  // `viewMode` keeps the last folder while Search, Subscriptions or Settings
  // is on screen; the route says whether a mail list is actually showing.
  const pathname = usePathname();
  useEffect(() => {
    noteCurrentPath(pathname);
  }, [pathname]);

  /** Recently delivered `email:new` ids: the same event twice is one new message. */
  const seenNewMail = useRef(new Set<string>());

  const onEmailNew = useCallback(
    (payload: unknown) => {
      if (!userId) return;
      if (!isEmailNewEvent(payload)) {
        recordInboxMetric('realtime_malformed_event');
        return;
      }
      // A repeat (a re-emit, a reconnect) is the same message: it bumped the
      // unread badge a second time and re-read the views for nothing.
      const seen = seenNewMail.current;
      if (seen.has(payload.id)) return;
      seen.add(payload.id);
      if (seen.size > SEEN_NEW_MAIL_LIMIT) seen.delete(seen.values().next().value as string);

      // 1. Optimistic prepend — instant, no round-trip.
      prependToMessageCache(
        queryClient,
        payload.mailboxId,
        userId,
        buildOptimisticMessage(payload, userId),
      );

      // 2. Bump the badge by one; the `email:unread_count` the server emits
      //    alongside reconciles the exact number a moment later. The total
      //    too: left as it was, the next mailbox poll saw the folder's count
      //    move and re-read its lists for mail already shown (`useMailboxPoll`).
      queryClient.setQueryData<Mailbox[] | undefined>(emailKeys.mailboxes.list(userId), (old) => {
        if (!old) return old;
        let mutated = false;
        const next = old.map((mb) => {
          if (mb._id !== payload.mailboxId) return mb;
          mutated = true;
          return {
            ...mb,
            unseenMessages: mb.unseenMessages + 1,
            totalMessages: mb.totalMessages + 1,
          };
        });
        return mutated ? next : old;
      });

      // 3. Reconcile: replace the placeholder with the real, fully-typed row.
      //    Then the conversation it joined — found by the real row's thread
      //    id once it is in; every thread was re-read for each new mail. A row
      //    that is its own thread (a new conversation, or the placeholder
      //    still) cannot say, so the open threads are re-read as before.
      //    Searches are only marked stale: re-run on every arrival, an open
      //    search cost a full search per new mail.
      void queryClient.invalidateQueries(messagesInMailbox(payload.mailboxId, userId)).then(() => {
        const row = findCachedMessage(queryClient, payload.id, userId);
        const threadId = row?.threadId && row.threadId !== row._id ? row.threadId : null;
        void queryClient.invalidateQueries(
          threadId
            ? {
                queryKey: emailKeys.thread.root,
                predicate: (query) =>
                  (query.state.data as ThreadData | undefined)?.messages.some(
                    (m) => m.threadId === threadId,
                  ) ?? false,
              }
            : { queryKey: emailKeys.thread.root },
        );
      });
      void queryClient.invalidateQueries({ queryKey: emailKeys.searchRoot, refetchType: 'none' });

      // 4. Toast only when the user is looking somewhere else. When they are
      //    already on the folder it landed in, the new row IS the notification.
      //    Never for mail filed as spam: every spam message used to pop a
      //    toast naming its sender. And never when the push for the same
      //    message already showed its OS banner: one message, one notification.
      //    Claimed whether or not it toasts, so a push arriving after this
      //    stays quiet too.
      const firstAnnouncement = claimNewMailAnnouncement(payload.id);
      const isViewingTargetMailbox = isLookingAtMailbox(viewMode, payload.mailboxId);
      const target = queryClient
        .getQueryData<Mailbox[]>(emailKeys.mailboxes.list(userId))
        ?.find((mb) => mb._id === payload.mailboxId);
      const isQuietFolder =
        target?.specialUse === SPECIAL_USE.SPAM ||
        target?.specialUse === SPECIAL_USE.TRASH ||
        /^(spam|junk|trash)$/i.test(payload.folder);
      if (firstAnnouncement && !isViewingTargetMailbox && !isQuietFolder) {
        toast.info(
          t('inbox.toast.newEmail', { sender: payload.from.name ?? payload.from.address }),
        );
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
  const reconcileTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (reconcileTimer.current) clearTimeout(reconcileTimer.current);
    },
    [],
  );

  /**
   * A message the user sent moved between sending, retrying, sent and not
   * delivered. The views re-read it with everything else below; a failed
   * delivery is also said wherever the user is, because it is the one outcome
   * of a send that must never be discovered by accident.
   *
   * Read through the message's own query, after the reconcile has asked for
   * it: an open message is then read once, not once for the views and again
   * here, and the answer is cached for opening it.
   */
  const onDeliveryChanged = useCallback(
    async (messageId: string) => {
      if (!api || !userId) return;
      let message: Message | null;
      try {
        message = await queryClient.fetchQuery({
          queryKey: emailKeys.message.detail(messageId, userId),
          queryFn: ({ signal }) => api.getMessage(messageId, { signal }),
          staleTime: 0,
        });
      } catch {
        return;
      }
      if (message?.delivery?.state !== 'failed') return;
      toast.error(
        t('delivery.failedToast', { subject: message.subject || t('message.detail.noSubject') }),
        {
          action: {
            label: t('delivery.view'),
            onClick: () => router.push(`/conversation/${messageId}`),
          },
        } as Record<string, unknown>,
      );
    },
    [api, queryClient, router, t, userId],
  );

  /** The burst being gathered: which messages changed, and whether any changed folder. */
  const pendingChanges = useRef({
    ids: new Set<string>(),
    folders: false,
    delivery: new Set<string>(),
  });

  const onEmailChanged = useCallback(
    (payload: unknown) => {
      if (!userId) return;
      if (!isEmailChangedEvent(payload)) {
        recordInboxMetric('realtime_malformed_event');
        return;
      }
      recordInboxMetric('realtime_email_changed');
      // The echo of a change this client made itself: the mutation has
      // already shown it, and re-reading every view for it was most of the
      // reconciles this hook ran.
      if (OWN_REASONS.has(payload.reason) && isOwnChange(payload.id)) return;

      // Not only the lists of the mailboxes it names: the message may be open,
      // in a conversation on screen or in search results — a draft sent from
      // another device stayed open here as a draft.
      //
      // Coalesced: the server sends one event per message changed, so a bulk
      // action on 100 messages arrived as 100 events and re-read every view
      // 100 times. A burst is reconciled once, after it settles, and only as
      // far as its changes reach (`invalidateChangedMail`).
      const pending = pendingChanges.current;
      pending.ids.add(payload.id);
      if (!IN_PLACE_REASONS.has(payload.reason)) pending.folders = true;
      if (payload.reason === 'delivery') pending.delivery.add(payload.id);
      if (reconcileTimer.current) clearTimeout(reconcileTimer.current);
      reconcileTimer.current = setTimeout(() => {
        reconcileTimer.current = null;
        const { ids, folders, delivery } = pendingChanges.current;
        pendingChanges.current = { ids: new Set(), folders: false, delivery: new Set() };
        invalidateChangedMail(queryClient, ids, { folders });
        for (const id of delivery) void onDeliveryChanged(id);
      }, CHANGED_COALESCE_MS);
    },
    [onDeliveryChanged, queryClient, userId],
  );

  useOxyEvent('email:new', onEmailNew);
  useOxyEvent('email:unread_count', onUnreadCount);
  useOxyEvent('email:changed', onEmailChanged);
}
