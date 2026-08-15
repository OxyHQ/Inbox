import { useQuery } from '@tanstack/react-query';
import { useEmailStore } from '@/hooks/useEmail';
import { emailKeys } from '@/hooks/queries/queryKeys';
import type { SavedEmailSearch } from '@/services/emailApi';

export function useSavedSearches() {
  const api = useEmailStore((s) => s._api);

  return useQuery<SavedEmailSearch[]>({
    queryKey: emailKeys.savedSearches,
    queryFn: async () => {
      if (!api) throw new Error('Email API not initialized');
      return api.listSavedSearches();
    },
    enabled: !!api,
  });
}
