import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@oxy.so/bloom';
import { useEmailStore } from '@/hooks/useEmail';
import { emailKeys } from '@/hooks/queries/queryKeys';
import { invalidateMailViews } from '@/hooks/queries/invalidateMailViews';
import type { Label } from '@/services/emailApi';
import { useTranslation } from '@/lib/i18n';
import { httpStatus } from '@/utils/httpStatus';

const LABELS_KEY = emailKeys.labels;

export function useLabels() {
  const api = useEmailStore((s) => s._api);

  return useQuery<Label[]>({
    queryKey: LABELS_KEY,
    queryFn: async () => {
      if (!api) throw new Error('Email API not initialized');
      return await api.listLabels();
    },
    enabled: !!api,
  });
}

/**
 * Snapshot the labels cache, apply an optimistic updater, and return the
 * previous value for rollback. Centralises the create/update/delete
 * optimistic pattern so the label picker reacts instantly.
 */
/**
 * Whether `name` is already taken by a label other than `exceptId`. The server
 * compares names case-insensitively ("Work" and "work" are one label), so this
 * does too — it lets the form say so before a round trip.
 */
export function isLabelNameTaken(
  labels: readonly Label[],
  name: string,
  exceptId?: string,
): boolean {
  const wanted = name.trim().toLocaleLowerCase();
  return labels.some((l) => l._id !== exceptId && l.name.trim().toLocaleLowerCase() === wanted);
}

async function optimisticLabels(
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (prev: Label[]) => Label[],
): Promise<{ prev: Label[] | undefined }> {
  await queryClient.cancelQueries({ queryKey: LABELS_KEY });
  const prev = queryClient.getQueryData<Label[]>(LABELS_KEY);
  queryClient.setQueryData<Label[]>(LABELS_KEY, (old) => updater(old ?? []));
  return { prev };
}

export function useCreateLabel() {
  const { t } = useTranslation();
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      if (!api) throw new Error('Email API not initialized');
      return await api.createLabel(name, color);
    },
    onMutate: async ({ name, color }) => {
      const tempId = `optimistic:${Date.now()}`;
      const now = new Date().toISOString();
      const optimistic: Label = {
        _id: tempId,
        id: tempId,
        userId: '',
        createdAt: now,
        updatedAt: now,
        name,
        color,
        order: Number.MAX_SAFE_INTEGER,
        // A user-created label is never a system one.
        system: false,
      };
      const { prev } = await optimisticLabels(queryClient, (labels) => [...labels, optimistic]);
      return { prev };
    },
    // The one place a failure is reported: the screen used to add a second
    // toast of its own, so every failure showed twice.
    onError: (err, { name }, context) => {
      if (context?.prev) queryClient.setQueryData(LABELS_KEY, context.prev);
      toast.error(
        httpStatus(err) === 409
          ? t('ui.mutations.labelNameTaken', { name: name.trim() })
          : t('ui.mutations.labelCreateFailed'),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: LABELS_KEY });
    },
  });
}

export function useUpdateLabel() {
  const { t } = useTranslation();
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      labelId,
      updates,
    }: {
      labelId: string;
      updates: { name?: string; color?: string };
    }) => {
      if (!api) throw new Error('Email API not initialized');
      return await api.updateLabel(labelId, updates);
    },
    onMutate: async ({ labelId, updates }) => {
      const { prev } = await optimisticLabels(queryClient, (labels) =>
        labels.map((l) => (l._id === labelId ? { ...l, ...updates } : l)),
      );
      return { prev };
    },
    onError: (err, { updates }, context) => {
      if (context?.prev) queryClient.setQueryData(LABELS_KEY, context.prev);
      toast.error(
        httpStatus(err) === 409 && updates.name
          ? t('ui.mutations.labelNameTaken', { name: updates.name.trim() })
          : t('ui.mutations.labelUpdateFailed'),
      );
    },
    // A rename is rewritten on the server onto every message, bundle and
    // filter that carries the label, so the chips on every list, the open
    // message and search results are all stale — not only the label list.
    onSuccess: () => {
      invalidateMailViews(queryClient);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: LABELS_KEY });
    },
  });
}

export function useDeleteLabel() {
  const { t } = useTranslation();
  const api = useEmailStore((s) => s._api);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (labelId: string) => {
      if (!api) throw new Error('Email API not initialized');
      await api.deleteLabel(labelId);
    },
    onMutate: async (labelId) => {
      const { prev } = await optimisticLabels(queryClient, (labels) =>
        labels.filter((l) => l._id !== labelId),
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(LABELS_KEY, context.prev);
      toast.error(t('ui.mutations.labelDeleteFailed'));
    },
    // Deleting a label removes it from every message that carried it.
    onSuccess: () => {
      invalidateMailViews(queryClient);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: LABELS_KEY });
    },
  });
}
