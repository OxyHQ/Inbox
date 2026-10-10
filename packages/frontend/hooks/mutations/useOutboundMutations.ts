import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@oxy.so/bloom';
import { useEmailStore } from '@/hooks/useEmail';
import { useTranslation } from '@/lib/i18n';
import { emailKeys } from '@/hooks/queries/queryKeys';

export function useRetryOutboundMessage() {
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (outboxId: string) => {
      if (!api) throw new Error('Email API not initialized');
      return api.retryOutboundMessage(outboxId);
    },
    onSuccess: () => toast.success(t('ui.mutations.retryQueued')),
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : t('ui.mutations.retryFailed')),
    onSettled: () => queryClient.invalidateQueries({ queryKey: emailKeys.outbox }),
  });
}

export function useCancelOutboundMessage() {
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (outboxId: string) => {
      if (!api) throw new Error('Email API not initialized');
      return api.cancelOutboundMessage(outboxId);
    },
    onSuccess: () => toast.success(t('ui.mutations.queuedCancelled')),
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : t('ui.mutations.cancelFailed')),
    onSettled: () => queryClient.invalidateQueries({ queryKey: emailKeys.outbox }),
  });
}
