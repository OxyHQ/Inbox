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

/** `subscriptions` with `senderAddress`'s row marked unsubscribed at `at`. */
export function markUnsubscribed(
  cache: SubscriptionsInfinite,
  senderAddress: string,
  at: string,
): SubscriptionsInfinite {
  return {
    ...cache,
    pages: cache.pages.map((page) => ({
      ...page,
      data: page.data.map((s) =>
        s._id === senderAddress
          ? { ...s, unsubscribed: true, unsubscribedAt: s.unsubscribedAt ?? at }
          : s,
      ),
    })),
  };
}

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

      // Mark the row unsubscribed — not remove it. Removed, it came straight
      // back with an active button on the refetch that followed, because the
      // sender still has mail in the mailbox; the API now reports the state
      // per sender (`unsubscribed`, `unsubscribedAt`), and the row says so.
      const unsubscribedAt = new Date().toISOString();
      queryClient.setQueryData<SubscriptionsInfinite>(emailKeys.subscriptions, (old) =>
        old ? markUnsubscribed(old, senderAddress, unsubscribedAt) : old,
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
    onSettled: (_result, error) => {
      if (error) return;
      // Stale, not refetched now: an API from before `unsubscribed` existed
      // would hand the sender back as still subscribed, and the row would flip
      // back to an active button under the user's finger. The next visit
      // reads the server's state.
      void queryClient.invalidateQueries({
        queryKey: emailKeys.subscriptions,
        refetchType: 'none',
      });
      // A block moves the sender's mail; every view that shows it is stale.
      invalidateMailViews(queryClient);
    },
  });
}
