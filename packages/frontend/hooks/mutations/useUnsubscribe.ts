import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { toast } from '@oxy.so/bloom';
import { useEmailStore } from '@/hooks/useEmail';
import { invalidateMailViews } from '@/hooks/queries/invalidateMailViews';
import { emailKeys } from '@/hooks/queries/queryKeys';
import type { Subscription, Pagination } from '@/services/emailApi';
import { useTranslation } from '@/lib/i18n';

interface SubscriptionsPage {
  data: Subscription[];
  pagination: Pagination;
}

type SubscriptionsInfinite = InfiniteData<SubscriptionsPage>;

export function useUnsubscribe() {
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({
      senderAddress,
      method,
    }: {
      senderAddress: string;
      method?: 'list-unsubscribe' | 'block';
    }) => {
      if (!api) throw new Error('Email API not initialized');
      return await api.unsubscribe(senderAddress, method);
    },
    onMutate: async ({ senderAddress }) => {
      await queryClient.cancelQueries({ queryKey: emailKeys.subscriptions });

      const prev = queryClient.getQueryData<SubscriptionsInfinite>(emailKeys.subscriptions);

      // Optimistically remove the subscription row
      queryClient.setQueryData<SubscriptionsInfinite>(
        emailKeys.subscriptions,
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              data: page.data.filter((s) => s._id !== senderAddress),
            })),
          };
        },
      );

      return { prev };
    },
    onSuccess: (result) => {
      const label =
        result.method === 'one-click' || result.method === 'http'
          ? t('subscriptions.toast.unsubscribed')
          : result.method === 'mailto'
            ? t('subscriptions.toast.requestSent')
            : t('subscriptions.toast.blocked');
      toast.success(label);
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(emailKeys.subscriptions, context.prev);
      }
      toast.error(t('ui.mutations.unsubscribeFailed'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: emailKeys.subscriptions });
      invalidateMailViews(queryClient);
    },
  });
}
