import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@oxy.so/bloom/toast';
import { emailKeys } from '@/hooks/queries/queryKeys';
import type { EmailFilter, EmailFilterCondition, EmailFilterAction } from '@/services/emailApi';
import { useTranslation } from '@/lib/i18n';
import {
  type OwnedVariables,
  type EmailMutationContext,
  useEmailMutationOwner,
  ownsEmailMutation,
  emailMutationApi,
  exposeOwnedEmailMutation,
} from '@/hooks/mutations/ownedEmailMutation';

const FILTERS_KEY = emailKeys.filters;
const rollbackSnapshots = new WeakMap<object, EmailFilter[] | undefined>();

type CreateFilterInput = {
  name: string;
  enabled?: boolean;
  conditions: EmailFilterCondition[];
  matchAll?: boolean;
  actions: EmailFilterAction[];
  order?: number;
};
type UpdateFilterInput = Partial<CreateFilterInput> & { filterId: string };

async function optimisticFilters<T>(
  queryClient: ReturnType<typeof useQueryClient>,
  variables: OwnedVariables<T>,
  updater: (prev: EmailFilter[]) => EmailFilter[],
): Promise<undefined> {
  if (!ownsEmailMutation(variables)) return undefined;
  await queryClient.cancelQueries({ queryKey: FILTERS_KEY });
  if (!ownsEmailMutation(variables)) return undefined;
  const prev = queryClient.getQueryData<EmailFilter[]>(FILTERS_KEY);
  rollbackSnapshots.set(variables, prev);
  queryClient.setQueryData<EmailFilter[]>(FILTERS_KEY, (old) => updater(old ?? []));
  return undefined;
}

function rollbackFilters<T>(
  queryClient: ReturnType<typeof useQueryClient>,
  variables: OwnedVariables<T>,
) {
  const prev = rollbackSnapshots.get(variables);
  if (prev) queryClient.setQueryData(FILTERS_KEY, prev);
}

export function useCreateFilter() {
  const owner = useEmailMutationOwner();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const mutation = useMutation<
    EmailFilter,
    Error,
    OwnedVariables<CreateFilterInput>,
    EmailMutationContext
  >({
    mutationFn: async (variables) => emailMutationApi(variables).createFilter(variables.input),
    onMutate: async (variables) => {
      const data = variables.input;
      const now = new Date().toISOString();
      const tempId = `optimistic:${Date.now()}`;
      const optimistic: EmailFilter = {
        _id: tempId,
        id: tempId,
        userId: '',
        name: data.name,
        enabled: data.enabled ?? true,
        conditions: data.conditions,
        matchAll: data.matchAll ?? true,
        actions: data.actions,
        order: data.order ?? Number.MAX_SAFE_INTEGER,
        createdAt: now,
        updatedAt: now,
      };
      return optimisticFilters(queryClient, variables, (filters) => [...filters, optimistic]);
    },
    onError: (_err, variables) => {
      if (!ownsEmailMutation(variables)) return;
      rollbackFilters(queryClient, variables);
      toast.error(t('ui.mutations.filterCreateFailed'));
    },
    onSettled: (_data, _error, variables) => {
      if (ownsEmailMutation(variables))
        void queryClient.invalidateQueries({ queryKey: FILTERS_KEY });
    },
  });
  return exposeOwnedEmailMutation(owner, mutation);
}

export function useUpdateFilter() {
  const owner = useEmailMutationOwner();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const mutation = useMutation<
    EmailFilter,
    Error,
    OwnedVariables<UpdateFilterInput>,
    EmailMutationContext
  >({
    mutationFn: async (variables) => {
      const { filterId, ...updates } = variables.input;
      return emailMutationApi(variables).updateFilter(filterId, updates);
    },
    onMutate: async (variables) => {
      const { filterId, ...updates } = variables.input;
      return optimisticFilters(queryClient, variables, (filters) =>
        filters.map((filter) => (filter._id === filterId ? { ...filter, ...updates } : filter)),
      );
    },
    onError: (_err, variables) => {
      if (!ownsEmailMutation(variables)) return;
      rollbackFilters(queryClient, variables);
      toast.error(t('ui.mutations.filterUpdateFailed'));
    },
    onSettled: (_data, _error, variables) => {
      if (ownsEmailMutation(variables))
        void queryClient.invalidateQueries({ queryKey: FILTERS_KEY });
    },
  });
  return exposeOwnedEmailMutation(owner, mutation);
}

export function useDeleteFilter() {
  const owner = useEmailMutationOwner();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const mutation = useMutation<void, Error, OwnedVariables<string>, EmailMutationContext>({
    mutationFn: async (variables) => emailMutationApi(variables).deleteFilter(variables.input),
    onMutate: async (variables) =>
      optimisticFilters(queryClient, variables, (filters) =>
        filters.filter((filter) => filter._id !== variables.input),
      ),
    onError: (_err, variables) => {
      if (!ownsEmailMutation(variables)) return;
      rollbackFilters(queryClient, variables);
      toast.error(t('ui.mutations.filterDeleteFailed'));
    },
    onSettled: (_data, _error, variables) => {
      if (ownsEmailMutation(variables))
        void queryClient.invalidateQueries({ queryKey: FILTERS_KEY });
    },
  });
  return exposeOwnedEmailMutation(owner, mutation);
}
