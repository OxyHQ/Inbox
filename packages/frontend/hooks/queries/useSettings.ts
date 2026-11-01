import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useGuardedMessageMutation } from '@/hooks/mutations/guardedMessageMutation';
import { useTranslation } from '@/lib/i18n';
import { toast } from '@oxy.so/bloom/toast';
import { useOxy } from '@oxy.so/services/ui/client';
import { useEmailStore } from '@/hooks/useEmail';
import { emailKeys } from '@/hooks/queries/queryKeys';
import type { EmailSettings } from '@/services/emailApi';

export function useSettings() {
  const api = useEmailStore((s) => s._api);
  const { user } = useOxy();
  const userId = user?.id ?? null;

  return useQuery<EmailSettings>({
    queryKey: emailKeys.settings(userId),
    queryFn: async () => {
      if (!api) throw new Error('Email API not initialized');
      return api.getSettings();
    },
    enabled: !!api && !!userId,
  });
}

export function useUpdateSettings() {
  const api = useEmailStore((s) => s._api);
  const { user } = useOxy();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const onUnavailable = useCallback(
    () => toast.error(t('ui.settings.account.sessionUnavailable')),
    [t],
  );

  return useGuardedMessageMutation(
    {
      onMutate: () => undefined,
      mutationFn: async (settings: Partial<EmailSettings>) => {
        if (!api) throw new Error('Email API not initialized');
        await api.updateSettings(settings);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: emailKeys.settings(userId) });
      },
    },
    onUnavailable,
  );
}
