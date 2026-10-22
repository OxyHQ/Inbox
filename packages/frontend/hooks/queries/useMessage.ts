import { useQuery } from '@tanstack/react-query';
import { useOxy } from '@oxy.so/services/ui/client';
import { useEmailApi } from '@/hooks/useEmailApi';
import { emailKeys } from '@/hooks/queries/queryKeys';
import { type Message, UnreadableMessageError } from '@/services/emailApi';

export function useMessage(messageId: string | undefined) {
  const api = useEmailApi();
  const { user } = useOxy();
  const userId = user?.id ?? null;

  return useQuery<Message | null, Error, Message | null | undefined>({
    select: (data) => (api ? data : undefined),
    queryKey: emailKeys.message.detail(messageId, userId),
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Email API not initialized');
      if (!messageId) return null;
      return api.getMessage(messageId, { signal });
    },
    enabled: !!messageId && !!api && !!userId,
    // A message that fails the schema fails it again: the reader shows it as
    // unreadable at once rather than after the retries.
    retry: (failureCount, error) => !(error instanceof UnreadableMessageError) && failureCount < 2,
  });
}
