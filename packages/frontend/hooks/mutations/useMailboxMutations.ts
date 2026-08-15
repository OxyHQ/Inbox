import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEmailStore } from '@/hooks/useEmail';
import { emailKeys } from '@/hooks/queries/queryKeys';
import { toast } from '@oxyhq/bloom';
import { useTranslation } from '@/lib/i18n';

export function useCreateMailbox() {
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ name, parentPath }: { name: string; parentPath?: string }) => {
      if (!api) throw new Error('Email API not initialized');
      return api.createMailbox(name, parentPath);
    },
    onSuccess: () => {
      toast.success(t('ui.mutations.mailboxCreated'));
      queryClient.invalidateQueries({ queryKey: emailKeys.mailboxes.root });
    },
    onError: () => {
      toast.error(t('ui.mutations.mailboxCreateFailed'));
    },
  });
}

export function useDeleteMailbox() {
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ mailboxId }: { mailboxId: string }) => {
      if (!api) throw new Error('Email API not initialized');
      return api.deleteMailbox(mailboxId);
    },
    onSuccess: () => {
      toast.success(t('ui.mutations.mailboxDeleted'));
      queryClient.invalidateQueries({ queryKey: emailKeys.mailboxes.root });
    },
    onError: () => {
      toast.error(t('ui.mutations.mailboxDeleteFailed'));
    },
  });
}
