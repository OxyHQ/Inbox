import { useQuery } from '@tanstack/react-query';
import { useEmailApi } from '@/hooks/useEmailApi';
import { emailKeys } from '@/hooks/queries/queryKeys';
import type { Bundle } from '@/services/emailApi';

export function useBundles() {
  const api = useEmailApi();

  return useQuery<Bundle[], Error, Bundle[] | undefined>({
    select: (data) => (api ? data : undefined),
    queryKey: emailKeys.bundles,
    queryFn: async () => {
      if (!api) throw new Error('Email API not initialized');
      return api.listBundles();
    },
    enabled: !!api,
    staleTime: 5 * 60 * 1000,
  });
}
