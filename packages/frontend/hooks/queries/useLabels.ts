import {
  useQuery,
  useMutation,
  useQueryClient,
  type MutateOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { toast } from '@oxy.so/bloom/toast';
import { useOxy } from '@oxy.so/services/ui/client';
import { useCallback, useSyncExternalStore } from 'react';
import { useEmailStore } from '@/hooks/useEmail';
import { useEmailApi } from '@/hooks/useEmailApi';
import { emailKeys } from '@/hooks/queries/queryKeys';
import { invalidateMailViews } from '@/hooks/queries/invalidateMailViews';
import type { EmailApiInstance, Label } from '@/services/emailApi';
import type { OxyServices } from '@oxy.so/core';
import { useTranslation } from '@/lib/i18n';
import { httpStatus } from '@/utils/httpStatus';

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
  if (!ownsMutation(variables)) return undefined;
  await queryClient.cancelQueries({ queryKey: LABELS_KEY });
  if (!ownsMutation(variables)) return undefined;
  const prev = queryClient.getQueryData<Label[]>(LABELS_KEY);
  rollbackSnapshots.set(variables, prev);
  queryClient.setQueryData<Label[]>(LABELS_KEY, (old) => updater(old ?? []));
  return undefined;
}

/** The store replaces the API whenever the active account is reset. */
function isCurrentApi(api: EmailApiInstance | null): boolean {
  return useEmailStore.getState()._api === api;
}

/**
 * The API remains in memory: mutation variables may be dehydrated by older SDKs.
 * A deserialized operation has no owner and must never run under a new account.
 */
type OwnedVariables<T> = { input: T };
type LabelOwner = {
  api: EmailApiInstance | null;
  http: OxyServices['http'];
  epoch: number;
};
type LabelMutationContext = undefined;
const rollbackSnapshots = new WeakMap<object, Label[] | undefined>();
const mutationOwners = new WeakMap<object, LabelOwner>();

/** Capture the SDK's session epoch as a React snapshot for callbacks from this render. */
function useLabelOwner(): LabelOwner {
  const api = useEmailStore((s) => s._api);
  const { oxyServices } = useOxy();
  const http = oxyServices.http;
  const subscribe = useCallback(
    (notify: () => void) => http.addTokenChangeListener(notify),
    [http],
  );
  const snapshot = useCallback(() => http.getSessionEpoch(), [http]);
  const epoch = useSyncExternalStore(subscribe, snapshot, snapshot);
  return { api, http, epoch };
}

function ownsMutation<T>(variables: OwnedVariables<T>): boolean {
  const owner = mutationOwners.get(variables);
  return (
    owner?.api != null && isCurrentApi(owner.api) && owner.http.getSessionEpoch() === owner.epoch
  );
}

/** Both values are immutable snapshots from the corresponding React renders. */
function matchesRenderOwner<T>(variables: OwnedVariables<T>, current: LabelOwner): boolean {
  const initial = mutationOwners.get(variables);
  return (
    initial?.api != null &&
    initial.api === current.api &&
    initial.http === current.http &&
    initial.epoch === current.epoch
  );
}

function mutationApi<T>(variables: OwnedVariables<T>): EmailApiInstance {
  if (!mutationOwners.has(variables)) throw new Error('Email account changed');
  const owner = mutationOwners.get(variables);
  if (!owner?.api) throw new Error('Email API not initialized');
  if (!ownsMutation(variables)) throw new Error('Email account changed');
  return owner.api;
}

/** Bind each invocation to the API from its originating render, including per-call callbacks. */
function exposeOwnedMutation<TData, TVariables>(
  owner: LabelOwner,
  mutation: UseMutationResult<TData, Error, OwnedVariables<TVariables>, LabelMutationContext>,
) {
  type PublicOptions = MutateOptions<TData, Error, TVariables, LabelMutationContext>;
  const prepare = (input: TVariables, options?: PublicOptions) => {
    const variables: OwnedVariables<TVariables> = { input };
    mutationOwners.set(variables, owner);
    const adapted:
      | MutateOptions<TData, Error, OwnedVariables<TVariables>, LabelMutationContext>
      | undefined = options && {
      onSuccess: (data, owned, context, mutationContext) => {
        if (ownsMutation(owned)) options.onSuccess?.(data, owned.input, context, mutationContext);
      },
      onError: (error, owned, context, mutationContext) => {
        if (ownsMutation(owned)) options.onError?.(error, owned.input, context, mutationContext);
      },
      onSettled: (data, error, owned, context, mutationContext) => {
        if (ownsMutation(owned))
          options.onSettled?.(data, error, owned.input, context, mutationContext);
      },
    };
    return { variables, options: adapted };
  };
  const visible = !mutation.variables || matchesRenderOwner(mutation.variables, owner);
  return {
    ...mutation,
    ...(!visible
      ? {
          context: undefined,
          data: undefined,
          error: null,
          failureCount: 0,
          failureReason: null,
          isError: false,
          isIdle: true,
          isPaused: false,
          isPending: false,
          isSuccess: false,
          status: 'idle' as const,
          submittedAt: 0,
        }
      : {}),
    variables: visible ? mutation.variables?.input : undefined,
    mutate: (input: TVariables, options?: PublicOptions) => {
      const prepared = prepare(input, options);
      mutation.mutate(prepared.variables, prepared.options);
    },
    mutateAsync: (input: TVariables, options?: PublicOptions) => {
      const prepared = prepare(input, options);
      return mutation.mutateAsync(prepared.variables, prepared.options).then(
        (data) => {
          if (!ownsMutation(prepared.variables)) throw new Error('Email account changed');
          return data;
        },
        (error: unknown) => {
          if (!ownsMutation(prepared.variables)) throw new Error('Email account changed');
          throw error;
        },
      );
    },
  };
}

export function useCreateLabel() {
  const { t } = useTranslation();
  const owner = useLabelOwner();
  const queryClient = useQueryClient();
  type Input = { name: string; color: string };
  const mutation = useMutation<Label, Error, OwnedVariables<Input>, LabelMutationContext>({
    mutationFn: async (variables) =>
      mutationApi(variables).createLabel(variables.input.name, variables.input.color),
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
      if (!ownsMutation(variables)) return;
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
      if (ownsMutation(variables)) void queryClient.invalidateQueries({ queryKey: LABELS_KEY });
    },
  });
  return exposeOwnedMutation(owner, mutation);
}

export function useUpdateLabel() {
  const { t } = useTranslation();
  const owner = useLabelOwner();
  const queryClient = useQueryClient();
  type Input = { labelId: string; updates: { name?: string; color?: string } };
  const mutation = useMutation<Label, Error, OwnedVariables<Input>, LabelMutationContext>({
    mutationFn: async (variables) =>
      mutationApi(variables).updateLabel(variables.input.labelId, variables.input.updates),
    onMutate: async (variables) =>
      optimisticLabels(queryClient, variables, (labels) =>
        labels.map((label) =>
          label._id === variables.input.labelId ? { ...label, ...variables.input.updates } : label,
        ),
      ),
    onError: (err, variables) => {
      if (!ownsMutation(variables)) return;
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
      if (!ownsMutation(variables)) return;
      invalidateMailViews(queryClient);
      void queryClient.invalidateQueries({ queryKey: emailKeys.bundles });
    },
    onSettled: (_data, _error, variables) => {
      if (ownsMutation(variables)) void queryClient.invalidateQueries({ queryKey: LABELS_KEY });
    },
  });
  return exposeOwnedMutation(owner, mutation);
}

export function useDeleteLabel() {
  const { t } = useTranslation();
  const owner = useLabelOwner();
  const queryClient = useQueryClient();
  const mutation = useMutation<void, Error, OwnedVariables<string>, LabelMutationContext>({
    mutationFn: async (variables) => mutationApi(variables).deleteLabel(variables.input),
    onMutate: async (variables) =>
      optimisticLabels(queryClient, variables, (labels) =>
        labels.filter((label) => label._id !== variables.input),
      ),
    onError: (_err, variables) => {
      if (!ownsMutation(variables)) return;
      const prev = rollbackSnapshots.get(variables);
      if (prev) queryClient.setQueryData(LABELS_KEY, prev);
      toast.error(t('ui.mutations.labelDeleteFailed'));
    },
    onSuccess: (_data, variables) => {
      if (!ownsMutation(variables)) return;
      invalidateMailViews(queryClient);
      void queryClient.invalidateQueries({ queryKey: emailKeys.bundles });
    },
    onSettled: (_data, _error, variables) => {
      if (ownsMutation(variables)) void queryClient.invalidateQueries({ queryKey: LABELS_KEY });
    },
  });
  return exposeOwnedMutation(owner, mutation);
}
