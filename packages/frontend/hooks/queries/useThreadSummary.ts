/** Thread summaries through Oxy's exact message-scoped Inbox inference route. */

import { useQuery } from '@tanstack/react-query';
import { useOxy } from '@oxy.so/services';
import { aiKeys } from '@/hooks/queries/queryKeys';
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
  options: UseThreadSummaryOptions = {},
) {
  const { oxyServices, user } = useOxy();
  const { enabled = true, minMessages = 4 } = options;
  const shouldFetch = enabled && !!user && !!messageId && !!messages && messages.length >= minMessages;

  const query = useQuery({
    queryKey: aiKeys.threadSummary(messageId),
    queryFn: async (): Promise<ThreadSummaryResult> => {
      const result = await runInboxThreadSummary(oxyServices.httpService, messageId);
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

  return {
    summary: query.data?.summary ?? '',
    keyPoints: query.data?.keyPoints ?? [],
    actionItems: query.data?.actionItems ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
