/** Smart replies through Oxy's message-scoped Inbox inference route. */

import { useQuery } from '@tanstack/react-query';
import { useOxy } from '@oxy.so/services';
import { aiKeys } from '@/hooks/queries/queryKeys';
import { runInboxSmartReplies } from '@/services/inboxInferenceApi';
import type { Message } from '@/services/emailApi';

interface SmartRepliesResult {
  replies: string[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useSmartReplies(message: Message | null | undefined): SmartRepliesResult {
  const { oxyServices } = useOxy();

  const query = useQuery({
    queryKey: aiKeys.smartReplies(message?._id),
    queryFn: async () => {
      if (!message) throw new Error('A message is required for smart replies.');
      const result = await runInboxSmartReplies(oxyServices.httpService, message._id);
      return result.replies;
    },
    // Suggestions are always explicit opt-in via refetch. The backend owns the
    // sensitive/no-reply guard before it sends any bounded content to Kaana.
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
