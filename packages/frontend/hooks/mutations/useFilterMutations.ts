import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@oxyhq/bloom';
import { useEmailStore } from '@/hooks/useEmail';
import { emailKeys } from '@/hooks/queries/queryKeys';
import type { EmailFilter, EmailFilterCondition, EmailFilterAction } from '@/services/emailApi';
import { useTranslation } from '@/lib/i18n';

const FILTERS_KEY = emailKeys.filters;

/**
 * Snapshot the filters cache, apply an optimistic updater, and return the
 * previous value for rollback — same pattern as message/label mutations so
 * the Filters list reacts instantly.
 */
async function optimisticFilters(
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (prev: EmailFilter[]) => EmailFilter[],
): Promise<{ prev: EmailFilter[] | undefined }> {
  await queryClient.cancelQueries({ queryKey: FILTERS_KEY });
  const prev = queryClient.getQueryData<EmailFilter[]>(FILTERS_KEY);
  queryClient.setQueryData<EmailFilter[]>(FILTERS_KEY, (old) => updater(old ?? []));
  return { prev };
}

export function useCreateFilter() {
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      enabled?: boolean;
      conditions: EmailFilterCondition[];
      matchAll?: boolean;
      actions: EmailFilterAction[];
      order?: number;
    }) => {
      if (!api) throw new Error('Email API not initialized');
      return api.createFilter(data);
    },
    onMutate: async (data) => {
      const now = new Date().toISOString();
      const optimistic: EmailFilter = {
        _id: `optimistic:${Date.now()}`,
        userId: '',
        name: data.name,
        enabled: data.enabled ?? true,
        conditions: data.conditions,
        matchAll: data.matchAll ?? true,
        actions: data.actions,
        order: data.order ?? Number.MAX_SAFE_INTEGER,
        createdAt: now,
        updatedAt: now,
      };
      const { prev } = await optimisticFilters(queryClient, (filters) => [...filters, optimistic]);
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(FILTERS_KEY, context.prev);
      toast.error(t('ui.mutations.filterCreateFailed'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: FILTERS_KEY });
    },
  });
}

export function useUpdateFilter() {
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({
      filterId,
      ...updates
    }: {
      filterId: string;
      name?: string;
      enabled?: boolean;
      conditions?: EmailFilterCondition[];
      matchAll?: boolean;
      actions?: EmailFilterAction[];
      order?: number;
    }) => {
      if (!api) throw new Error('Email API not initialized');
      return api.updateFilter(filterId, updates);
    },
    onMutate: async ({ filterId, ...updates }) => {
      const { prev } = await optimisticFilters(queryClient, (filters) =>
        filters.map((f) => (f._id === filterId ? { ...f, ...updates } : f)),
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(FILTERS_KEY, context.prev);
      toast.error(t('ui.mutations.filterUpdateFailed'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: FILTERS_KEY });
    },
  });
}

export function useDeleteFilter() {
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (filterId: string) => {
      if (!api) throw new Error('Email API not initialized');
      return api.deleteFilter(filterId);
    },
    onMutate: async (filterId) => {
      const { prev } = await optimisticFilters(queryClient, (filters) =>
        filters.filter((f) => f._id !== filterId),
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(FILTERS_KEY, context.prev);
      toast.error(t('ui.mutations.filterDeleteFailed'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: FILTERS_KEY });
    },
  });
}
