import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEmailStore } from '@/hooks/useEmail';
import { emailKeys } from '@/hooks/queries/queryKeys';
import { toast } from '@oxyhq/bloom';
import { useTranslation } from '@/lib/i18n';

export function useCreateReminder() {
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: { text: string; remindAt: string; relatedMessageId?: string }) => {
      if (!api) throw new Error('Email API not initialized');
      return api.createReminder(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emailKeys.reminders.root });
    },
    onError: () => {
      toast.error(t('ui.mutations.reminderCreateFailed'));
    },
  });
}

export function useUpdateReminder() {
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({
      reminderId,
      ...updates
    }: {
      reminderId: string;
      text?: string;
      remindAt?: string;
      completed?: boolean;
      pinned?: boolean;
      snoozedUntil?: string | null;
    }) => {
      if (!api) throw new Error('Email API not initialized');
      return api.updateReminder(reminderId, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emailKeys.reminders.root });
    },
    onError: () => {
      toast.error(t('ui.mutations.reminderUpdateFailed'));
    },
  });
}

export function useDeleteReminder() {
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (reminderId: string) => {
      if (!api) throw new Error('Email API not initialized');
      return api.deleteReminder(reminderId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emailKeys.reminders.root });
    },
    onError: () => {
      toast.error(t('ui.mutations.reminderDeleteFailed'));
    },
  });
}
