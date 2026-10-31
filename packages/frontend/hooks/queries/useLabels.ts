import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@oxy.so/bloom/toast';
import { useEmailApi } from '@/hooks/useEmailApi';
import { emailKeys } from '@/hooks/queries/queryKeys';
import { invalidateMailViews } from '@/hooks/queries/invalidateMailViews';
import type { Label } from '@/services/emailApi';
import { useTranslation } from '@/lib/i18n';
import { httpStatus } from '@/utils/httpStatus';
import {
  type OwnedVariables,
  type EmailMutationContext,
  useEmailMutationOwner,
  ownsEmailMutation,
  emailMutationApi,
  exposeOwnedEmailMutation,
} from '@/hooks/mutations/ownedEmailMutation';

const LABELS_KEY = emailKeys.labels;

export function useLabels({ enabled = true }: { enabled?: boolean } = {}) {
  const api = useEmailApi();

  return useQuery<Label[], Error, Label[] | undefined>({
    select: (data) => (api ? data : undefined),
    queryKey: LABELS_KEY,
    queryFn: async () => {
      if (!api) throw new Error('Email API not initialized');
      return await api.listLabels();
    },
    enabled: enabled && !!api,
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

async function optimisticLabels<T>(
  queryClient: ReturnType<typeof useQueryClient>,
  variables: OwnedVariables<T>,
  updater: (prev: Label[]) => Label[],
): Promise<undefined> {
  if (!ownsEmailMutation(variables)) return undefined;
  await queryClient.cancelQueries({ queryKey: LABELS_KEY });
  if (!ownsEmailMutation(variables)) return undefined;
  const prev = queryClient.getQueryData<Label[]>(LABELS_KEY);
  rollbackSnapshots.set(variables, prev);
  queryClient.setQueryData<Label[]>(LABELS_KEY, (old) => updater(old ?? []));
  return undefined;
}

const rollbackSnapshots = new WeakMap<object, Label[] | undefined>();

export function useCreateLabel() {
  const { t } = useTranslation();
  const owner = useEmailMutationOwner();
  const queryClient = useQueryClient();
  type Input = { name: string; color: string };
  const mutation = useMutation<Label, Error, OwnedVariables<Input>, EmailMutationContext>({
    mutationFn: async (variables) =>
      emailMutationApi(variables).createLabel(variables.input.name, variables.input.color),
    onMutate: async (variables) => {
      const { name, color } = variables.input;
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
        system: false,
      };
      return optimisticLabels(queryClient, variables, (labels) => [...labels, optimistic]);
    },
    onError: (err, variables) => {
      if (!ownsEmailMutation(variables)) return;
      const prev = rollbackSnapshots.get(variables);
      if (prev) queryClient.setQueryData(LABELS_KEY, prev);
      const { name } = variables.input;
      toast.error(
        httpStatus(err) === 409
          ? t('ui.mutations.labelNameTaken', { name: name.trim() })
          : t('ui.mutations.labelCreateFailed'),
      );
    },
    onSettled: (_data, _error, variables) => {
      if (ownsEmailMutation(variables))
        void queryClient.invalidateQueries({ queryKey: LABELS_KEY });
    },
  });
  return exposeOwnedEmailMutation(owner, mutation);
}

export function useUpdateLabel() {
  const { t } = useTranslation();
  const owner = useEmailMutationOwner();
  const queryClient = useQueryClient();
  type Input = { labelId: string; updates: { name?: string; color?: string } };
  const mutation = useMutation<Label, Error, OwnedVariables<Input>, EmailMutationContext>({
    mutationFn: async (variables) =>
      emailMutationApi(variables).updateLabel(variables.input.labelId, variables.input.updates),
    onMutate: async (variables) =>
      optimisticLabels(queryClient, variables, (labels) =>
        labels.map((label) =>
          label._id === variables.input.labelId ? { ...label, ...variables.input.updates } : label,
        ),
      ),
    onError: (err, variables) => {
      if (!ownsEmailMutation(variables)) return;
      const prev = rollbackSnapshots.get(variables);
      if (prev) queryClient.setQueryData(LABELS_KEY, prev);
      const { updates } = variables.input;
      toast.error(
        httpStatus(err) === 409 && updates.name
          ? t('ui.mutations.labelNameTaken', { name: updates.name.trim() })
          : t('ui.mutations.labelUpdateFailed'),
      );
    },
    onSuccess: (_data, variables) => {
      if (!ownsEmailMutation(variables)) return;
      invalidateMailViews(queryClient);
      void queryClient.invalidateQueries({ queryKey: emailKeys.bundles });
    },
    onSettled: (_data, _error, variables) => {
      if (ownsEmailMutation(variables))
        void queryClient.invalidateQueries({ queryKey: LABELS_KEY });
    },
  });
  return exposeOwnedEmailMutation(owner, mutation);
}

export function useDeleteLabel() {
  const { t } = useTranslation();
  const owner = useEmailMutationOwner();
  const queryClient = useQueryClient();
  const mutation = useMutation<void, Error, OwnedVariables<string>, EmailMutationContext>({
    mutationFn: async (variables) => emailMutationApi(variables).deleteLabel(variables.input),
    onMutate: async (variables) =>
      optimisticLabels(queryClient, variables, (labels) =>
        labels.filter((label) => label._id !== variables.input),
      ),
    onError: (_err, variables) => {
      if (!ownsEmailMutation(variables)) return;
      const prev = rollbackSnapshots.get(variables);
      if (prev) queryClient.setQueryData(LABELS_KEY, prev);
      toast.error(t('ui.mutations.labelDeleteFailed'));
    },
    onSuccess: (_data, variables) => {
      if (!ownsEmailMutation(variables)) return;
      invalidateMailViews(queryClient);
      void queryClient.invalidateQueries({ queryKey: emailKeys.bundles });
    },
    onSettled: (_data, _error, variables) => {
      if (ownsEmailMutation(variables))
        void queryClient.invalidateQueries({ queryKey: LABELS_KEY });
    },
  });
  return exposeOwnedEmailMutation(owner, mutation);
}
