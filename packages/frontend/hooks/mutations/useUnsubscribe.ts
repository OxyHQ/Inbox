import { useCallback } from 'react';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { toast } from '@oxy.so/bloom/toast';
import { useEmailStore } from '@/hooks/useEmail';
import { invalidateMailViews } from '@/hooks/queries/invalidateMailViews';
import { emailKeys } from '@/hooks/queries/queryKeys';
import type { Subscription, Pagination } from '@/services/emailApi';
import { useTranslation } from '@/lib/i18n';
import {
  assertMessageOwner,
  ownsMessageOperation,
  useGuardedMessageMutation,
} from '@/hooks/mutations/guardedMessageMutation';

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
  const onUnavailable = useCallback(
    () => toast.error(t('subscriptions.toast.sessionUnavailable')),
    [t],
  );

  return useGuardedMessageMutation(
    {
      // This action can contact the sender and must not be retried automatically.
      retry: 0,
      mutationFn: async ({
        senderAddress,
        method,
      }: {
        senderAddress: string;
        method?: 'list-unsubscribe' | 'block';
      }) => {
        if (!api) throw new Error('Email API not initialized');
        const result = await api.unsubscribe(senderAddress, method);
        if (!result.success) throw new Error('Unsubscribe was not confirmed');
        return result;
      },
      onMutate: async (variables) => {
        await queryClient.cancelQueries({ queryKey: emailKeys.subscriptions });
        assertMessageOwner(variables);
      },
      onSuccess: async (result, variables) => {
        // A refetch begun while the request was pending must not overwrite the
        // server-confirmed result with older subscription data.
        await queryClient.cancelQueries({ queryKey: emailKeys.subscriptions });
        assertMessageOwner(variables);
        const unsubscribedAt = new Date().toISOString();
        queryClient.setQueryData<SubscriptionsInfinite>(emailKeys.subscriptions, (old) =>
          old ? markUnsubscribed(old, variables.senderAddress, unsubscribedAt) : old,
        );
        if (!ownsMessageOperation(variables)) return;
        const label =
          result.method === 'one-click' || result.method === 'http'
            ? t('subscriptions.toast.unsubscribed')
            : result.method === 'mailto'
              ? t('subscriptions.toast.requestSent')
              : t('subscriptions.toast.blocked');
        toast.success(label);
      },
      onError: (_err, variables) => {
        toast.error(t('subscriptions.toast.unconfirmed'));
        if (ownsMessageOperation(variables))
          void queryClient.invalidateQueries({
            queryKey: emailKeys.subscriptions,
            refetchType: 'none',
          });
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
    },
    onUnavailable,
  );
}
