import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@oxy.so/bloom';
import { useOxy } from '@oxy.so/services';
import { useEmailStore } from '@/hooks/useEmail';
import { useTranslation } from '@/lib/i18n';
import { emailKeys } from '@/hooks/queries/queryKeys';
import { invalidateMailViews } from '@/hooks/queries/invalidateMailViews';
import { INBOX_MUTATION_KEYS, RETRY_IDEMPOTENT } from '@/hooks/queries/queryClient';
import type { Message } from '@/services/emailApi';
import { recordInboxMetric } from '@/utils/inboxTelemetry';
import {
  cancelMessageQueries,
  findCachedMessage,
  flatMessages,
  mergeServerMessage,
  patchMailboxUnseen,
  patchMessageFlags,
  patchMessageInList,
  removeMessageFromList,
  restoreSnapshot,
  snapshotForRollback,
  snapshotOrigins,
  type MessageSnapshot,
  type MessagesInfinite,
} from '@/utils/messageCache';

export function useToggleStar() {
  const { t } = useTranslation();
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();
  const { user } = useOxy();
  const userId = user?.id ?? null;

  return useMutation({
    mutationKey: INBOX_MUTATION_KEYS.toggleStar,
    // Offline-first: when the device is offline this mutation is queued
    // (status "paused") and auto-resumes when connectivity returns. The
    // mutationFn re-runs through the SDK `httpService`, so auth + CSRF are
    // preserved on replay (see utils/offlineQueue.ts for the full rationale).
    networkMode: 'offlineFirst',
    mutationFn: async ({ messageId, starred }: { messageId: string; starred: boolean }) => {
      if (!api) throw new Error('Email API not initialized');
      return await api.updateFlags(messageId, { starred });
    },
    onMutate: async ({ messageId, starred }) => {
      await cancelMessageQueries(queryClient, messageId);
      const snapshot = snapshotForRollback(queryClient, messageId, userId);

      // VIEW-AWARE UPDATE: in the starred view, unstarring removes the row.
      const viewMode = useEmailStore.getState().viewMode;
      if (viewMode?.type === 'starred' && !starred) {
        removeMessageFromList(queryClient, messageId);
        // Keep detail/thread flags in sync for any open panel.
        patchMessageFlags(queryClient, messageId, userId, { starred });
      } else {
        patchMessageFlags(queryClient, messageId, userId, { starred });
      }

      return { snapshot };
    },
    onError: (_err, _vars, context) => {
      if (context) restoreSnapshot(queryClient, context.snapshot);
      toast.error(t('ui.mutations.starFailed'));
    },
    onSuccess: (updatedMessage, { messageId }) => {
      if (updatedMessage) {
        // Don't restore the row to the list if it was removed from starred view.
        const viewMode = useEmailStore.getState().viewMode;
        const skipList = viewMode?.type === 'starred' && !updatedMessage.flags.starred;
        mergeServerMessage(queryClient, messageId, userId, updatedMessage, { skipList });
      }
    },
    onSettled: () => {
      // Reconcile filtered caches (e.g. Starred) with the server.
      invalidateMailViews(queryClient);
    },
  });
}

export function useToggleRead() {
  const { t } = useTranslation();
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();
  const { user } = useOxy();
  const userId = user?.id ?? null;

  return useMutation({
    mutationKey: INBOX_MUTATION_KEYS.toggleRead,
    // Offline-first — see useToggleStar for the queue/replay rationale.
    networkMode: 'offlineFirst',
    mutationFn: async ({ messageId, seen }: { messageId: string; seen: boolean }) => {
      if (!api) throw new Error('Email API not initialized');
      return await api.updateFlags(messageId, { seen });
    },
    onMutate: async ({ messageId, seen }) => {
      await cancelMessageQueries(queryClient, messageId);
      const snapshot = snapshotForRollback(queryClient, messageId, userId);

      // Only adjust the mailbox badge if the seen state actually changes.
      const cached = findCachedMessage(queryClient, messageId, userId);
      if (cached && cached.flags.seen !== seen) {
        // seen=true → one fewer unread; seen=false → one more unread.
        patchMailboxUnseen(queryClient, cached.mailboxId, seen ? -1 : 1);
      }

      patchMessageFlags(queryClient, messageId, userId, { seen });

      return { snapshot };
    },
    onError: (_err, _vars, context) => {
      if (context) restoreSnapshot(queryClient, context.snapshot);
      toast.error(t('ui.mutations.readFailed'));
    },
    onSuccess: (updatedMessage, { messageId }) => {
      if (updatedMessage) {
        mergeServerMessage(queryClient, messageId, userId, updatedMessage);
      }
    },
    onSettled: () => {
      // Lists, message and thread are already synced from the server response
      // in onSuccess; search, bundles and the unseen counts are not.
      invalidateMailViews(queryClient, { views: 'stale' });
    },
  });
}

/**
 * What a move does, as the toast after it says. A single move used to report
 * "Archived" whatever the destination — Spam and Inbox included.
 */
export type MoveKind = 'archive' | 'inbox' | 'spam' | 'move';

const MOVE_TOAST: Record<MoveKind, string> = {
  archive: 'ui.mutations.archived',
  inbox: 'ui.mutations.movedToInbox',
  spam: 'ui.mutations.movedToSpam',
  move: 'ui.mutations.moved',
};

type EmailApi = NonNullable<ReturnType<typeof useEmailStore.getState>['_api']>;

/**
 * A success toast with Undo. Archive, Trash, Spam, a folder, Snooze: each
 * takes mail out of the list, and there was no way to bring it back — no Undo,
 * and nothing in Archive to move a message back to the Inbox with.
 *
 * Undo puts the rows back where they were at once (the mutation's own
 * snapshot), returns each message to the folder it came from, then re-reads.
 * It lives in the mutation, not the screen, so it still works when the screen
 * that acted has closed — archiving from the reader goes back to the list.
 */
function toastWithUndo({
  message,
  snapshot,
  reverse,
  queryClient,
  t,
}: {
  message: string;
  snapshot: MessageSnapshot;
  reverse: (origins: Map<string, string>) => Promise<unknown>;
  queryClient: ReturnType<typeof useQueryClient>;
  t: (key: string) => string;
}) {
  const origins = snapshotOrigins(snapshot);
  if (origins.size === 0) {
    toast.success(message);
    return;
  }
  toast.success(message, {
    action: {
      label: t('common.undo'),
      onClick: () => {
        restoreSnapshot(queryClient, snapshot, { reread: false });
        reverse(origins)
          .catch(() => toast.error(t('ui.mutations.undoFailed')))
          .finally(() => invalidateMailViews(queryClient));
      },
    },
  } as Record<string, unknown>);
}

/** Every message back to the folder it came from — one request per folder. */
function moveBack(api: EmailApi, origins: Map<string, string>): Promise<unknown> {
  const byMailbox = new Map<string, string[]>();
  for (const [id, mailboxId] of origins) {
    byMailbox.set(mailboxId, [...(byMailbox.get(mailboxId) ?? []), id]);
  }
  return Promise.all(
    [...byMailbox].map(([mailboxId, ids]) => api.bulkMoveMessages(ids, mailboxId)),
  );
}

export function useArchiveMessage() {
  const { t } = useTranslation();
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: INBOX_MUTATION_KEYS.archive,
    // Offline-first — see useToggleStar for the queue/replay rationale.
    networkMode: 'offlineFirst',
    mutationFn: async ({
      messageId,
      archiveMailboxId,
    }: {
      messageId: string;
      archiveMailboxId: string;
      kind?: MoveKind;
    }) => {
      if (!api) throw new Error('Email API not initialized');
      await api.moveMessage(messageId, archiveMailboxId);
    },
    onMutate: async ({ messageId }) => {
      await cancelMessageQueries(queryClient, messageId);
      const snapshot = snapshotForRollback(queryClient, messageId, null);
      removeMessageFromList(queryClient, messageId);
      return { snapshot };
    },
    onSuccess: (_data, { kind = 'archive' }, context) => {
      if (!api || !context) {
        toast.success(t(MOVE_TOAST[kind]));
        return;
      }
      toastWithUndo({
        message: t(MOVE_TOAST[kind]),
        snapshot: context.snapshot,
        reverse: (origins) => moveBack(api, origins),
        queryClient,
        t,
      });
    },
    onError: (_err, _vars, context) => {
      if (context) restoreSnapshot(queryClient, context.snapshot);
      toast.error(t('ui.mutations.archiveFailed'));
    },
    onSettled: () => {
      // Mark stale but don't trigger immediate refetch — optimistic update is already applied
      invalidateMailViews(queryClient, { views: 'stale' });
    },
  });
}

export function useDeleteMessage() {
  const { t } = useTranslation();
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: INBOX_MUTATION_KEYS.delete,
    // Offline-first — see useToggleStar for the queue/replay rationale.
    networkMode: 'offlineFirst',
    mutationFn: async ({
      messageId,
      trashMailboxId,
      isInTrash,
    }: {
      messageId: string;
      trashMailboxId?: string;
      isInTrash: boolean;
    }) => {
      if (!api) throw new Error('Email API not initialized');
      if (isInTrash) {
        await api.deleteMessage(messageId, true);
      } else if (trashMailboxId) {
        await api.moveMessage(messageId, trashMailboxId);
      } else {
        await api.deleteMessage(messageId);
      }
    },
    onMutate: async ({ messageId }) => {
      await cancelMessageQueries(queryClient, messageId);
      const snapshot = snapshotForRollback(queryClient, messageId, null);
      removeMessageFromList(queryClient, messageId);
      return { snapshot };
    },
    onSuccess: (_data, { isInTrash, trashMailboxId }, context) => {
      // Deleted for good (or without a Trash to come back from): nothing to undo.
      if (isInTrash || !trashMailboxId || !api || !context) {
        toast.success(isInTrash ? t('ui.mutations.deletedForever') : t('ui.mutations.trashed'));
        return;
      }
      toastWithUndo({
        message: t('ui.mutations.trashed'),
        snapshot: context.snapshot,
        reverse: (origins) => moveBack(api, origins),
        queryClient,
        t,
      });
    },
    onError: (_err, _vars, context) => {
      if (context) restoreSnapshot(queryClient, context.snapshot);
      toast.error(t('ui.mutations.deleteFailed'));
    },
    onSettled: () => {
      // Mark stale but don't trigger immediate refetch — optimistic update is already applied
      invalidateMailViews(queryClient, { views: 'stale' });
    },
  });
}

export function useSendMessage() {
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: Parameters<NonNullable<typeof api>['sendMessage']>[0]) => {
      if (!api) throw new Error('Email API not initialized');
      // The key travels in the mutation VARIABLES, so react-query's retry
      // re-sends the same key rather than minting a second message.
      return api.sendMessage(params);
    },
    onSettled: () => {
      invalidateAfterSend(queryClient);
    },
  });
}

/**
 * A send changes the lists and the mailbox counts, and a send of a draft also
 * removes that draft — so its own detail and any thread it was shown in are
 * stale too.
 */
function invalidateAfterSend(queryClient: ReturnType<typeof useQueryClient>) {
  invalidateMailViews(queryClient);
}

const UNDO_SEND_DELAY_MS = 5000;

/** A send waiting out its undo window. */
export interface PendingSend {
  /**
   * Call the send off. True when it was still waiting; false once it has gone
   * to the server, when nothing can stop it any more.
   */
  cancel: () => boolean;
}

export function useSendMessageWithUndo() {
  const { t } = useTranslation();
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);

  const sendWithUndo = useCallback(
    (
      params: Parameters<NonNullable<typeof api>['sendMessage']>[0],
      options?: {
        /** The message LEFT. Safe to discard the local recovery snapshot. */
        onSuccess?: () => void;
        /**
         * The server accepted the message but has not delivered it yet. The
         * composer may close — the server holds the message — but the local
         * crash-recovery snapshot MUST survive, because "queued" includes the
         * case where delivery never happens.
         */
        onQueued?: () => void;
        onError?: (err: unknown) => void;
        /** Undo was pressed: nothing was sent and the composer is live again. */
        onCancel?: () => void;
      },
    ): PendingSend => {
      if (!api) {
        options?.onError?.(new Error('Email API not initialized'));
        return { cancel: () => false };
      }

      // Each send owns its window. The window is the timer's, not the toast's:
      // a toast pauses while hovered or while the page is hidden, so it can
      // still offer Undo after the timer has sent the message. Once the send
      // has fired the toast is dismissed and Undo does nothing.
      let state: 'waiting' | 'cancelled' | 'fired' = 'waiting';
      setIsPending(true);

      const cancel = (): boolean => {
        if (state !== 'waiting') return false;
        state = 'cancelled';
        clearTimeout(timer);
        toast.dismiss(toastId);
        setIsPending(false);
        options?.onCancel?.();
        return true;
      };

      const toastId = toast(t('ui.mutations.sending'), {
        duration: UNDO_SEND_DELAY_MS,
        action: {
          label: t('common.undo'),
          onClick: () => {
            if (cancel()) toast(t('ui.mutations.sendCancelled'));
          },
        },
      } as Record<string, unknown>);

      const timer = setTimeout(async () => {
        if (state !== 'waiting') return;
        state = 'fired';
        toast.dismiss(toastId);

        try {
          const result = await api.sendMessage(params);
          invalidateAfterSend(queryClient);

          if (result.queued) {
            // `queued` is NOT `sent`. It means the relay refused the message
            // for a reason the server judged transient and parked it in the
            // durable outbox; it may still never leave. Treating it as success
            // is how a total outbound outage looked like a working inbox — an
            // info toast, the composer closing, and the recovery snapshot
            // deleted. Surface it as an outstanding delivery and keep the
            // snapshot.
            queryClient.invalidateQueries({ queryKey: emailKeys.outbox });
            toast.warning(result.message, {
              duration: 10000,
              description: t('ui.mutations.queuedDescription'),
            } as Record<string, unknown>);
            recordInboxMetric('composer_send_queued', { queued: true });
            options?.onQueued?.();
            return;
          }

          toast.success(result.message);
          recordInboxMetric('composer_send_succeeded');
          options?.onSuccess?.();
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : t('compose.toast.sendFailed');
          toast.error(message);
          recordInboxMetric('composer_send_failed');
          options?.onError?.(err);
        } finally {
          setIsPending(false);
        }
      }, UNDO_SEND_DELAY_MS);

      return { cancel };
    },
    [api, queryClient, t],
  );

  return {
    sendWithUndo,
    isPending,
  };
}

export function useUpdateMessageLabels() {
  const { t } = useTranslation();
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();
  const { user } = useOxy();
  const userId = user?.id ?? null;

  return useMutation({
    ...RETRY_IDEMPOTENT,
    mutationFn: async ({
      messageId,
      add,
      remove,
    }: {
      messageId: string;
      add: string[];
      remove: string[];
    }) => {
      if (!api) throw new Error('Email API not initialized');
      return await api.updateLabels(messageId, add, remove);
    },
    onMutate: async ({ messageId, add, remove }) => {
      await cancelMessageQueries(queryClient, messageId);
      const snapshot = snapshotForRollback(queryClient, messageId, userId);
      const applyLabels = (labels: string[]): string[] => [
        ...labels.filter((l) => !remove.includes(l)),
        ...add.filter((l) => !labels.includes(l)),
      ];
      queryClient.setQueryData<Message | null>(
        emailKeys.message.detail(messageId, userId),
        (old) => (old ? { ...old, labels: applyLabels(old.labels) } : old),
      );
      patchMessageInList(queryClient, messageId, (m) => ({ ...m, labels: applyLabels(m.labels) }));
      return { snapshot };
    },
    onError: (_err, _vars, context) => {
      if (context) restoreSnapshot(queryClient, context.snapshot);
      toast.error(t('ui.mutations.labelsFailed'));
    },
    onSettled: (_data, _err, { messageId }) => {
      // The list is updated optimistically; the message, thread and search are not.
      void queryClient.invalidateQueries({ queryKey: emailKeys.message.byId(messageId) });
      invalidateMailViews(queryClient, { views: 'stale' });
    },
  });
}

export function useTogglePin() {
  const { t } = useTranslation();
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();
  const { user } = useOxy();
  const userId = user?.id ?? null;

  return useMutation({
    ...RETRY_IDEMPOTENT,
    mutationFn: async ({ messageId, pinned }: { messageId: string; pinned: boolean }) => {
      if (!api) throw new Error('Email API not initialized');
      return await api.updateFlags(messageId, { pinned });
    },
    onMutate: async ({ messageId, pinned }) => {
      await cancelMessageQueries(queryClient, messageId);
      const snapshot = snapshotForRollback(queryClient, messageId, userId);
      patchMessageFlags(queryClient, messageId, userId, { pinned });
      return { snapshot };
    },
    onError: (_err, _vars, context) => {
      if (context) restoreSnapshot(queryClient, context.snapshot);
      toast.error(t('ui.mutations.pinFailed'));
    },
    onSettled: () => {
      // Re-read, not just marked stale: a pin MOVES the message — the API lists
      // pinned messages first — and the optimistic flag cannot. An unpinned
      // message sat on top of the list under its date heading until the poll.
      invalidateMailViews(queryClient);
    },
  });
}

export function useSnoozeMessage() {
  const { t } = useTranslation();
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();
  const { user } = useOxy();
  const userId = user?.id ?? null;

  return useMutation({
    ...RETRY_IDEMPOTENT,
    // A conversation is one mutation: one toast, and one rollback that covers
    // exactly its messages. Snoozed message by message, it showed a toast per
    // message, and one failure's rollback brought back the ones that had
    // snoozed.
    mutationFn: async ({ messageIds, until }: { messageIds: string[]; until: string }) => {
      if (!api) throw new Error('Email API not initialized');
      const results = await Promise.allSettled(
        messageIds.map((id) => api.snoozeMessage(id, until)),
      );
      const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (failed) throw failed.reason;
    },
    onMutate: async ({ messageIds }) => {
      await cancelMessageQueries(queryClient);
      const snapshot = snapshotForRollback(queryClient, messageIds, userId);
      for (const messageId of messageIds) removeMessageFromList(queryClient, messageId);
      return { snapshot };
    },
    onSuccess: (_data, _vars, context) => {
      if (!api || !context) {
        toast.success(t('ui.mutations.snoozed'));
        return;
      }
      toastWithUndo({
        message: t('ui.mutations.snoozed'),
        snapshot: context.snapshot,
        reverse: (origins) => Promise.all([...origins.keys()].map((id) => api.unsnoozeMessage(id))),
        queryClient,
        t,
      });
    },
    onError: (_err, _vars, context) => {
      if (context) restoreSnapshot(queryClient, context.snapshot);
      toast.error(t('ui.mutations.snoozeFailed'));
    },
    onSettled: () => {
      // Mark stale but don't trigger immediate refetch — optimistic update is already applied
      invalidateMailViews(queryClient, { views: 'stale' });
    },
  });
}

export function useUnsnoozeMessage() {
  const { t } = useTranslation();
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();
  const { user } = useOxy();
  const userId = user?.id ?? null;

  return useMutation({
    ...RETRY_IDEMPOTENT,
    mutationFn: async ({ messageId }: { messageId: string }) => {
      if (!api) throw new Error('Email API not initialized');
      return await api.unsnoozeMessage(messageId);
    },
    onMutate: async ({ messageId }) => {
      // Same optimistic pattern as useSnoozeMessage: unsnoozing removes the row
      // from the current (Snoozed) view. Rollback via snapshot on error.
      await cancelMessageQueries(queryClient, messageId);
      const snapshot = snapshotForRollback(queryClient, messageId, userId);
      removeMessageFromList(queryClient, messageId);
      return { snapshot };
    },
    onSuccess: () => {
      toast.success(t('ui.mutations.unsnoozed'));
    },
    onError: (_err, _vars, context) => {
      if (context) restoreSnapshot(queryClient, context.snapshot);
      toast.error(t('ui.mutations.unsnoozeFailed'));
    },
    onSettled: () => {
      // Mark stale but don't trigger immediate refetch — optimistic update is already applied
      invalidateMailViews(queryClient, { views: 'stale' });
    },
  });
}

// ─── Bulk Operations ─────────────────────────────────────────────

export function useBulkUpdateFlags() {
  const { t } = useTranslation();
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();
  const { user } = useOxy();
  const userId = user?.id ?? null;

  return useMutation({
    ...RETRY_IDEMPOTENT,
    mutationFn: async ({
      messageIds,
      flags,
    }: {
      messageIds: string[];
      flags: Partial<Message['flags']>;
      /** No success toast: the change is its own feedback (a conversation read on open). */
      quiet?: boolean;
    }) => {
      if (!api) throw new Error('Email API not initialized');
      return api.bulkUpdateFlags(messageIds, flags);
    },
    onMutate: async ({ messageIds, flags }) => {
      await queryClient.cancelQueries({ queryKey: emailKeys.messages.root });

      const snapshot = snapshotForRollback(queryClient, messageIds, userId);
      const prevMessages = queryClient.getQueriesData<MessagesInfinite>({
        queryKey: emailKeys.messages.root,
      });

      if (flags.seen !== undefined) {
        // Each message once: the same message is cached in every list it
        // appears in (Inbox and Starred, say), and counting it per list moved
        // the badge by two.
        const ids = new Set(messageIds);
        const seenIds = new Set<string>();
        const unseenDeltas = new Map<string, number>();
        for (const [, data] of prevMessages) {
          for (const message of flatMessages(data)) {
            if (!ids.has(message._id) || seenIds.has(message._id)) continue;
            seenIds.add(message._id);
            if (message.flags.seen !== flags.seen && message.mailboxId) {
              const delta = flags.seen ? -1 : 1;
              unseenDeltas.set(
                message.mailboxId,
                (unseenDeltas.get(message.mailboxId) ?? 0) + delta,
              );
            }
          }
        }
        for (const [mailboxId, delta] of unseenDeltas) {
          patchMailboxUnseen(queryClient, mailboxId, delta);
        }
      }

      // Lists, the open message and the open conversation alike.
      for (const messageId of messageIds) {
        patchMessageFlags(queryClient, messageId, userId, flags);
      }

      return { snapshot };
    },
    onError: (_err, _vars, context) => {
      if (context) restoreSnapshot(queryClient, context.snapshot);
      toast.error(t('ui.mutations.bulkFailed'));
    },
    onSuccess: (_data, { quiet }) => {
      if (!quiet) toast.success(t('ui.mutations.bulkUpdated'));
    },
    onSettled: () => {
      invalidateMailViews(queryClient, { views: 'stale' });
    },
  });
}

export function useBulkMoveMessages() {
  const { t } = useTranslation();
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();

  return useMutation({
    ...RETRY_IDEMPOTENT,
    mutationFn: async ({
      messageIds,
      mailboxId,
    }: {
      messageIds: string[];
      mailboxId: string;
      kind?: MoveKind;
    }) => {
      if (!api) throw new Error('Email API not initialized');
      return api.bulkMoveMessages(messageIds, mailboxId);
    },
    onMutate: async ({ messageIds }) => {
      await queryClient.cancelQueries({ queryKey: emailKeys.messages.root });
      const snapshot = snapshotForRollback(queryClient, messageIds, null);
      removeMessagesFromLists(queryClient, messageIds);
      return { snapshot };
    },
    onSuccess: (_data, { kind = 'move' }, context) => {
      if (!api || !context) {
        toast.success(t(MOVE_TOAST[kind]));
        return;
      }
      toastWithUndo({
        message: t(MOVE_TOAST[kind]),
        snapshot: context.snapshot,
        reverse: (origins) => moveBack(api, origins),
        queryClient,
        t,
      });
    },
    onError: (_err, _vars, context) => {
      if (context) restoreSnapshot(queryClient, context.snapshot);
      toast.error(t('ui.mutations.moveFailed'));
    },
    onSettled: () => {
      invalidateMailViews(queryClient, { views: 'stale' });
    },
  });
}

/**
 * Delete several messages: to Trash, or — for messages already in Trash —
 * for good. Bulk delete used to MOVE everything to Trash, which the server
 * skips for rows already there; in Trash the selection vanished optimistically
 * and came back on the next refresh, never deleted.
 */
export function useBulkDeleteMessages() {
  const { t } = useTranslation();
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      toTrash,
      permanent,
      trashMailboxId,
    }: {
      /** Messages to move to Trash. */
      toTrash: string[];
      /** Messages already in Trash, deleted for good. */
      permanent: string[];
      trashMailboxId?: string;
    }) => {
      if (!api) throw new Error('Email API not initialized');
      if (toTrash.length > 0) {
        if (!trashMailboxId) throw new Error('Trash mailbox not found');
        await api.bulkMoveMessages(toTrash, trashMailboxId);
      }
      const results = await Promise.allSettled(permanent.map((id) => api.deleteMessage(id, true)));
      const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (failed) throw failed.reason;
    },
    onMutate: async ({ toTrash, permanent }) => {
      await queryClient.cancelQueries({ queryKey: emailKeys.messages.root });
      const ids = [...toTrash, ...permanent];
      const snapshot = snapshotForRollback(queryClient, ids, null);
      removeMessagesFromLists(queryClient, ids);
      return { snapshot };
    },
    onSuccess: (_data, { permanent, toTrash }, context) => {
      if (permanent.length > 0 || toTrash.length === 0 || !api || !context) {
        toast.success(
          permanent.length > 0 ? t('ui.mutations.deletedForever') : t('ui.mutations.trashed'),
        );
        return;
      }
      toastWithUndo({
        message: t('ui.mutations.trashed'),
        snapshot: context.snapshot,
        reverse: (origins) => moveBack(api, origins),
        queryClient,
        t,
      });
    },
    onError: (_err, _vars, context) => {
      if (context) restoreSnapshot(queryClient, context.snapshot);
      toast.error(t('ui.mutations.deleteFailed'));
    },
    onSettled: () => {
      invalidateMailViews(queryClient, { views: 'stale' });
    },
  });
}

function removeMessagesFromLists(
  queryClient: ReturnType<typeof useQueryClient>,
  messageIds: string[],
) {
  const ids = new Set(messageIds);
  queryClient.setQueriesData<MessagesInfinite>({ queryKey: emailKeys.messages.root }, (old) => {
    if (!old) return old;
    return {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        data: page.data.filter((m) => !ids.has(m._id)),
      })),
    };
  });
}

export function useSaveDraft() {
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: Parameters<NonNullable<typeof api>['saveDraft']>[0]) => {
      if (!api) throw new Error('Email API not initialized');
      return api.saveDraft(params);
    },
    // No toast here: this runs for every autosave. The composer shows the save
    // state beside the subject, and says "saved" itself when the user asked.
    onSettled: () => {
      // Refetch the Drafts list (the saved draft appears) and mailbox badges
      // (the Drafts unseen count) so the sidebar reflects the new draft.
      invalidateMailViews(queryClient);
    },
  });
}

/**
 * Throw a draft away for good. A discarded draft is not mail: moving it to
 * Trash would keep it a draft there, editable and sendable from the bin.
 */
export function useDiscardDraft() {
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (draftId: string) => {
      if (!api) throw new Error('Email API not initialized');
      await api.deleteMessage(draftId, true);
    },
    onSettled: () => {
      invalidateMailViews(queryClient);
    },
  });
}
