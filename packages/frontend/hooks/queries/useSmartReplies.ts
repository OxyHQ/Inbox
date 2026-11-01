/** Smart replies through Oxy's message-scoped Inbox inference route. */

import { useMemo } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { aiKeys } from '@/hooks/queries/queryKeys';
import type { SmartReplyOwner } from '@/hooks/queries/useSmartReplyOwner';
import { runInboxSmartReplies } from '@/services/inboxInferenceApi';
import type { Message } from '@/services/emailApi';

interface SmartRepliesResult {
  replies: string[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

const MOUNT_COUNTER = Symbol.for('inbox.smartReply.mountCounter.v1');

function nextMountNamespace(client: QueryClient): string {
  // Keep allocation on the client so remounts and module reloads cannot reuse
  // an earlier memory-only key while this QueryClient remains alive.
  const scoped = client as QueryClient & { [MOUNT_COUNTER]?: bigint };
  const next = (scoped[MOUNT_COUNTER] ?? 0n) + 1n;
  Object.defineProperty(scoped, MOUNT_COUNTER, { value: next, writable: true, enumerable: false });
  return next.toString();
}

function aborted(): Error {
  const error = new Error('Smart reply session changed.');
  error.name = 'AbortError';
  return error;
}

export function useSmartReplies(
  message: Message | null | undefined,
  owner: SmartReplyOwner,
): SmartRepliesResult {
  // The namespace prevents a later mount from attaching to an earlier mount's
  // in-memory query. The query root remains private and is excluded from disk.
  const client = useQueryClient();
  const mount = useMemo(() => nextMountNamespace(client), [client]);
  const query = useQuery({
    queryKey: [...aiKeys.smartReplies(message?._id), owner.binding, mount],
    queryFn: async ({ signal }) => {
      if (!message) throw new Error('A message is required for smart replies.');
      if (!owner.isCurrent()) throw aborted();
      const controller = new AbortController();
      let offToken = () => {};
      let offRuntime = () => {};
      let disposed = false;
      const dispose = () => {
        if (disposed) return;
        disposed = true;
        offToken();
        offRuntime();
        signal.removeEventListener('abort', stop);
      };
      const stop = () => {
        controller.abort();
        dispose();
      };
      const check = () => {
        if (!owner.isCurrent()) stop();
      };
      offToken = owner.http.addTokenChangeListener(check);
      offRuntime = owner.runtime.subscribe(check);
      signal.addEventListener('abort', stop, { once: true });
      if (signal.aborted) stop();
      check();
      try {
        if (controller.signal.aborted) throw aborted();
        const result = await runInboxSmartReplies(owner.http, message._id, controller.signal);
        if (controller.signal.aborted || !owner.isCurrent()) throw aborted();
        return result.replies;
      } finally {
        dispose();
      }
    },
    enabled: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
  });

  return {
    replies: query.data ?? [],
    isLoading: query.isFetching,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
