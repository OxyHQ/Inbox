import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@oxy.so/bloom/toast';
import { useOxy } from '@oxy.so/services/ui/client';

import { useEmailStore } from '@/hooks/useEmail';
import { emailKeys } from '@/hooks/queries/queryKeys';
import { useTranslation } from '@/lib/i18n';
import { mergeServerMessage } from '@/utils/messageCache';
import {
  ownsMessageOperation,
  useGuardedMessageMutation,
} from '@/hooks/mutations/guardedMessageMutation';

/** Try a message whose delivery failed again, with a fresh retry budget. */
export function useRetryDelivery() {
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();
  const { user } = useOxy();
  const userId = user?.id ?? null;
  const { t } = useTranslation();
  const onUnavailable = useCallback(
    () => toast.error(t('ui.mutations.messageSessionUnavailable')),
    [t],
  );

  return useGuardedMessageMutation(
    {
      // Retrying this POST can start a delivery; its outcome may be ambiguous.
      retry: 0,
      onMutate: () => undefined,
      mutationFn: async ({ messageId }: { messageId: string }) => {
        if (!api) throw new Error('Email API not initialized');
        return api.retryDelivery(messageId);
      },
      onSuccess: (message, variables) => {
        mergeServerMessage(queryClient, message._id, userId, message);
        if (ownsMessageOperation(variables)) toast.success(t('delivery.retryStarted'));
      },
      onError: () => toast.error(t('delivery.retryError')),
      onSettled: () => {
        void queryClient.invalidateQueries({ queryKey: emailKeys.messages.root });
      },
    },
    onUnavailable,
  );
}
