import { useQuery } from '@tanstack/react-query';
import { useEmailStore } from '@/hooks/useEmail';
import { emailKeys } from '@/hooks/queries/queryKeys';
import type { EmailOutbox } from '@/services/emailApi';

export function useOutboundMessages() {
  const api = useEmailStore((s) => s._api);

  return useQuery<EmailOutbox[]>({
    queryKey: emailKeys.outbox,
    queryFn: async () => {
      if (!api) throw new Error('Email API not initialized');
      return api.listOutboundMessages();
    },
    enabled: !!api,
    refetchInterval: 15_000,
  });
}
