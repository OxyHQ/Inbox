import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@oxyhq/bloom';
import { useEmailStore } from '@/hooks/useEmail';
import { emailKeys } from '@/hooks/queries/queryKeys';

export function useRetryOutboundMessage() {
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (outboxId: string) => {
      if (!api) throw new Error('Email API not initialized');
      return api.retryOutboundMessage(outboxId);
    },
    onSuccess: () => toast.success('Message queued for retry.'),
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Unable to retry message.'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: emailKeys.outbox }),
  });
}

export function useCancelOutboundMessage() {
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (outboxId: string) => {
      if (!api) throw new Error('Email API not initialized');
      return api.cancelOutboundMessage(outboxId);
    },
    onSuccess: () => toast.success('Queued message cancelled.'),
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Unable to cancel message.'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: emailKeys.outbox }),
  });
}
