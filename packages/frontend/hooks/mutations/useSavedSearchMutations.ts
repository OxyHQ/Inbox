import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@oxyhq/bloom';
import { useEmailStore } from '@/hooks/useEmail';
import { emailKeys } from '@/hooks/queries/queryKeys';
import type { SavedEmailSearch, SavedEmailSearchFilters } from '@/services/emailApi';

const key = emailKeys.savedSearches;

export function useCreateSavedSearch() {
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; query: string; filters: SavedEmailSearchFilters }) => {
      if (!api) throw new Error('Email API not initialized');
      return api.createSavedSearch(data);
    },
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SavedEmailSearch[]>(key);
      const now = new Date().toISOString();
      queryClient.setQueryData<SavedEmailSearch[]>(key, [
        ...(previous ?? []),
        { id: `optimistic:${Date.now()}`, ...data, order: previous?.length ?? 0, createdAt: now, updatedAt: now },
      ]);
      return { previous };
    },
    onError: (error: unknown, _data, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      toast.error(error instanceof Error ? error.message : 'Unable to save search.');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

export function useDeleteSavedSearch() {
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!api) throw new Error('Email API not initialized');
      return api.deleteSavedSearch(id);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SavedEmailSearch[]>(key);
      queryClient.setQueryData<SavedEmailSearch[]>(key, (old) => old?.filter((item) => item.id !== id) ?? []);
      return { previous };
    },
    onError: (error: unknown, _id, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      toast.error(error instanceof Error ? error.message : 'Unable to delete saved search.');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}
