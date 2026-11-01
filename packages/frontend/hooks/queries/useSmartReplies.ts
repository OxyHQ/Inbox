/** Smart replies through Oxy's message-scoped Inbox inference route. */

import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { aiKeys } from '@/hooks/queries/queryKeys';
import type { InferenceOwner } from '@/hooks/queries/useObservedInferenceOwner';
import { reserveInferenceNamespace } from '@/hooks/queries/inferenceNamespace';
import { runObservedInference } from '@/hooks/queries/runObservedInference';
import { runInboxSmartReplies } from '@/services/inboxInferenceApi';
import type { Message } from '@/services/emailApi';

interface SmartRepliesResult {
  replies: string[];
  isLoading: boolean;
  isPending: boolean;
  isPaused: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
}

export function useSmartReplies(
  message: Message | null | undefined,
  owner: InferenceOwner,
): SmartRepliesResult {
  // The namespace prevents a later mount from attaching to an earlier mount's
  // in-memory query. The query root remains private and is excluded from disk.
  const client = useQueryClient();
  const mount = useMemo(() => reserveInferenceNamespace(client), [client]);
  const query = useQuery({
    queryKey: [...aiKeys.smartReplies(message?._id), owner.binding, mount],
    queryFn: async ({ signal }) => {
      if (!message) throw new Error('A message is required for smart replies.');
      const result = await runObservedInference(owner, signal, (requestSignal) =>
        runInboxSmartReplies(owner.http, message._id, requestSignal),
      );
      return result.replies;
    },
    enabled: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
  });

  return {
    replies: query.data ?? [],
    isLoading: query.isFetching,
    isPending: query.isPending,
    isPaused: query.fetchStatus === 'paused',
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
