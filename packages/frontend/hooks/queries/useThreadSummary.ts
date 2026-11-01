/** Thread summaries through Oxy's exact message-scoped Inbox inference route. */

import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { aiKeys } from '@/hooks/queries/queryKeys';
import type { InferenceOwner } from '@/hooks/queries/useObservedInferenceOwner';
import { reserveInferenceNamespace } from '@/hooks/queries/inferenceNamespace';
import { runObservedInference } from '@/hooks/queries/runObservedInference';
import { runInboxThreadSummary } from '@/services/inboxInferenceApi';
import type { Message } from '@/services/emailApi';

export interface ThreadSummaryResult {
  summary: string;
  keyPoints: string[];
  actionItems: ActionItem[];
}

export interface ActionItem {
  text: string;
  owner?: string;
  deadline?: string;
}

interface UseThreadSummaryOptions {
  enabled?: boolean;
  minMessages?: number;
}

export function useThreadSummary(
  messageId: string,
  messages: Message[] | undefined,
  owner: InferenceOwner,
  options: UseThreadSummaryOptions = {},
) {
  const client = useQueryClient();
  const mountedRef = useRef(false);
  const scope = JSON.stringify([
    messageId,
    owner.binding,
    owner.subject,
    owner.sessionId,
    owner.revision,
    owner.epoch,
    owner.knownSubject,
    owner.authenticated,
  ]);
  const binding = useMemo(
    () => ({ scope, namespace: reserveInferenceNamespace(client) }),
    [client, scope],
  );
  const committedBinding = useRef<typeof binding | null>(null);
  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  useLayoutEffect(() => {
    committedBinding.current = binding;
    return () => {
      if (committedBinding.current === binding) committedBinding.current = null;
    };
  }, [binding]);
  const { enabled = true, minMessages = 1 } = options;
  const shouldFetch =
    enabled && owner.ready && !!messageId && !!messages && messages.length >= minMessages;

  const query = useQuery({
    queryKey: [...aiKeys.threadSummary(messageId), owner.binding, binding.namespace],
    queryFn: async ({ signal }): Promise<ThreadSummaryResult> => {
      const result = await runObservedInference(owner, signal, (requestSignal) =>
        runInboxThreadSummary(owner.http, messageId, requestSignal),
      );
      return {
        summary: result.summary,
        keyPoints: result.keyPoints,
        actionItems: result.actionItems.map((item) => ({
          text: item.text,
          owner: item.owner ?? undefined,
          deadline: item.deadline ?? undefined,
        })),
      };
    },
    enabled: shouldFetch,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });
  /** A retired binding returns undefined without starting another request. */
  const refetch = useCallback(() => {
    if (!mountedRef.current || committedBinding.current !== binding || !owner.isCurrent())
      return Promise.resolve(undefined);
    return query.refetch();
  }, [binding, owner, query.refetch]);

  return {
    summary: query.data?.summary ?? '',
    keyPoints: query.data?.keyPoints ?? [],
    actionItems: query.data?.actionItems ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch,
  };
}
