import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useEmailStore } from '@/hooks/useEmail';
import { emailKeys } from '@/hooks/queries/queryKeys';
import { invalidateMailViews } from '@/hooks/queries/invalidateMailViews';
import { toast } from '@oxy.so/bloom/toast';
import { useTranslation } from '@/lib/i18n';
import {
  ownsMessageOperation,
  useGuardedMessageMutation,
} from '@/hooks/mutations/guardedMessageMutation';

export function useCreateMailbox() {
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const onUnavailable = useCallback(
    () => toast.error(t('ui.mutations.mailboxSessionUnavailable')),
    [t],
  );

  return useGuardedMessageMutation(
    {
      retry: 0,
      onMutate: () => undefined,
      mutationFn: async ({ name, parentPath }: { name: string; parentPath?: string }) => {
        if (!api) throw new Error('Email API not initialized');
        return api.createMailbox(name, parentPath);
      },
      onSuccess: (_result, variables) => {
        toast.success(t('ui.mutations.mailboxCreated'));
        if (ownsMessageOperation(variables))
          void queryClient.invalidateQueries({ queryKey: emailKeys.mailboxes.root });
      },
      onError: () => toast.error(t('ui.mutations.mailboxCreateFailed')),
    },
    onUnavailable,
  );
}

export function useDeleteMailbox() {
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const onUnavailable = useCallback(
    () => toast.error(t('ui.mutations.mailboxSessionUnavailable')),
    [t],
  );

  return useGuardedMessageMutation(
    {
      retry: 0,
      onMutate: () => undefined,
      mutationFn: async ({ mailboxId }: { mailboxId: string }) => {
        if (!api) throw new Error('Email API not initialized');
        return api.deleteMailbox(mailboxId);
      },
      onSuccess: (_result, variables) => {
        toast.success(t('ui.mutations.mailboxDeleted'));
        // Deleted folder messages move to Archive; all mail views become stale.
        if (ownsMessageOperation(variables)) invalidateMailViews(queryClient);
      },
      onError: () => toast.error(t('ui.mutations.mailboxDeleteFailed')),
    },
    onUnavailable,
  );
}
