import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@oxy.so/bloom';
import { useOxy } from '@oxy.so/services/ui/client';

import { useEmailStore } from '@/hooks/useEmail';
import { emailKeys } from '@/hooks/queries/queryKeys';
import { useTranslation } from '@/lib/i18n';
import { mergeServerMessage } from '@/utils/messageCache';

/** Try a message whose delivery failed again, with a fresh retry budget. */
export function useRetryDelivery() {
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();
  const { user } = useOxy();
  const userId = user?.id ?? null;
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (messageId: string) => {
      if (!api) throw new Error('Email API not initialized');
      return api.retryDelivery(messageId);
    },
    onSuccess: (message) => {
      mergeServerMessage(queryClient, message._id, userId, message);
      toast.success(t('delivery.retryStarted'));
    },
    onError: () => toast.error(t('delivery.retryError')),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: emailKeys.messages.root });
    },
  });
}
