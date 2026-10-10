import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@oxy.so/bloom';
import { useTranslation } from '@/lib/i18n';
import { useEmailStore } from '@/hooks/useEmail';
import { emailKeys } from '@/hooks/queries/queryKeys';
import type { Bundle } from '@/services/emailApi';

const BUNDLES_KEY = emailKeys.bundles;

async function optimisticBundles(
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (prev: Bundle[]) => Bundle[],
): Promise<{ prev: Bundle[] | undefined }> {
  await queryClient.cancelQueries({ queryKey: BUNDLES_KEY });
  const prev = queryClient.getQueryData<Bundle[]>(BUNDLES_KEY);
  queryClient.setQueryData<Bundle[]>(BUNDLES_KEY, (old) => updater(old ?? []));
  return { prev };
}

/**
 * Update a single bundle's server-backed fields (enabled, collapsed,
 * matchLabels, order). Renaming is intentionally NOT exposed — the
 * `PUT /email/bundles/:id` endpoint does not accept a `name`, so bundle
 * names are owned by the server-side auto-bundling logic.
 */
export function useUpdateBundle() {
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({
      bundleId,
      ...updates
    }: {
      bundleId: string;
      enabled?: boolean;
      collapsed?: boolean;
      matchLabels?: string[];
      order?: number;
    }) => {
      if (!api) throw new Error('Email API not initialized');
      return api.updateBundle(bundleId, updates);
    },
    onMutate: async ({ bundleId, ...updates }) => {
      const { prev } = await optimisticBundles(queryClient, (bundles) =>
        bundles.map((b) => (b._id === bundleId ? { ...b, ...updates } : b)),
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(BUNDLES_KEY, context.prev);
      toast.error(t('ui.mutations.bundleUpdateFailed'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: BUNDLES_KEY });
    },
  });
}

/** The two `order` writes that move a bundle one place, or null at an end. */
export function planBundleSwap(
  bundles: Bundle[],
  bundleId: string,
  direction: 'up' | 'down',
): { id: string; order: number }[] | null {
  const sorted = [...bundles].sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex((b) => b._id === bundleId);
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (idx === -1 || swapIdx < 0 || swapIdx >= sorted.length) return null;
  return [
    { id: sorted[idx]._id, order: sorted[swapIdx].order },
    { id: sorted[swapIdx]._id, order: sorted[idx].order },
  ];
}

/**
 * Reorder a bundle by swapping its `order` with the adjacent bundle in the
 * given direction. Applies the swap optimistically to the `['bundles']`
 * cache, then persists both bundles' new order.
 *
 * The swap is planned ONCE, from the order before the optimistic update.
 * `mutationFn` used to plan it again from the cache — which `onMutate` had
 * already swapped — so "up" found no neighbour and sent nothing, and "down"
 * swapped with the bundle two places away.
 */
export function useReorderBundle() {
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const mutation = useMutation({
    mutationFn: async ({ swap }: { swap: { id: string; order: number }[] }) => {
      if (!api) throw new Error('Email API not initialized');
      await Promise.all(swap.map(({ id, order }) => api.updateBundle(id, { order })));
    },
    onMutate: async ({ swap }) => {
      const orders = new Map(swap.map(({ id, order }) => [id, order]));
      const { prev } = await optimisticBundles(queryClient, (bundles) =>
        bundles.map((b) => (orders.has(b._id) ? { ...b, order: orders.get(b._id)! } : b)),
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(BUNDLES_KEY, context.prev);
      toast.error(t('ui.mutations.bundleReorderFailed'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: BUNDLES_KEY });
    },
  });

  const { mutate } = mutation;
  return {
    ...mutation,
    /** Move a bundle one place up or down. Nothing at either end. */
    mutate: ({ bundleId, direction }: { bundleId: string; direction: 'up' | 'down' }) => {
      const swap = planBundleSwap(
        queryClient.getQueryData<Bundle[]>(BUNDLES_KEY) ?? [],
        bundleId,
        direction,
      );
      if (swap) mutate({ swap });
    },
  };
}
