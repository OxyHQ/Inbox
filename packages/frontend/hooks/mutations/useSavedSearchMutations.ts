import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@oxy.so/bloom/toast';
import { emailKeys } from '@/hooks/queries/queryKeys';
import type { SavedEmailSearch, SavedEmailSearchFilters } from '@/services/emailApi';
import { useTranslation } from '@/lib/i18n';
import {
  type OwnedVariables,
  type EmailMutationContext,
  useEmailMutationOwner,
  ownsEmailMutation,
  emailMutationApi,
  exposeOwnedEmailMutation,
} from '@/hooks/mutations/ownedEmailMutation';

const key = emailKeys.savedSearches;
const rollbackSnapshots = new WeakMap<object, SavedEmailSearch[] | undefined>();

type CreateSavedSearchInput = { name: string; query: string; filters: SavedEmailSearchFilters };

async function optimisticSavedSearches<T>(
  queryClient: ReturnType<typeof useQueryClient>,
  variables: OwnedVariables<T>,
  update: (previous: SavedEmailSearch[]) => SavedEmailSearch[],
): Promise<undefined> {
  if (!ownsEmailMutation(variables)) return undefined;
  await queryClient.cancelQueries({ queryKey: key });
  if (!ownsEmailMutation(variables)) return undefined;
  const previous = queryClient.getQueryData<SavedEmailSearch[]>(key);
  rollbackSnapshots.set(variables, previous);
  queryClient.setQueryData<SavedEmailSearch[]>(key, update(previous ?? []));
  return undefined;
}

function rollbackSavedSearches<T>(
  queryClient: ReturnType<typeof useQueryClient>,
  variables: OwnedVariables<T>,
) {
  const previous = rollbackSnapshots.get(variables);
  if (previous) queryClient.setQueryData(key, previous);
}

export function useCreateSavedSearch() {
  const owner = useEmailMutationOwner(true);
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const mutation = useMutation<
    SavedEmailSearch,
    Error,
    OwnedVariables<CreateSavedSearchInput>,
    EmailMutationContext
  >({
    mutationFn: async (variables) => emailMutationApi(variables).createSavedSearch(variables.input),
    onMutate: async (variables) =>
      optimisticSavedSearches(queryClient, variables, (previous) => {
        const now = new Date().toISOString();
        return [
          ...previous,
          {
            id: `optimistic:${Date.now()}`,
            ...variables.input,
            order: previous.length,
            createdAt: now,
            updatedAt: now,
          },
        ];
      }),
    onError: (error, variables) => {
      if (!ownsEmailMutation(variables)) return;
      rollbackSavedSearches(queryClient, variables);
      toast.error(error instanceof Error ? error.message : t('search.saved.saveFailed'));
    },
    onSettled: (_data, _error, variables) => {
      if (ownsEmailMutation(variables)) return queryClient.invalidateQueries({ queryKey: key });
    },
  });
  return exposeOwnedEmailMutation(owner, mutation);
}

export function useDeleteSavedSearch() {
  const owner = useEmailMutationOwner(true);
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const mutation = useMutation<void, Error, OwnedVariables<string>, EmailMutationContext>({
    mutationFn: async (variables) => emailMutationApi(variables).deleteSavedSearch(variables.input),
    onMutate: async (variables) =>
      optimisticSavedSearches(queryClient, variables, (previous) =>
        previous.filter((item) => item.id !== variables.input),
      ),
    onError: (error, variables) => {
      if (!ownsEmailMutation(variables)) return;
      rollbackSavedSearches(queryClient, variables);
      toast.error(error instanceof Error ? error.message : t('search.saved.deleteFailed'));
    },
    onSettled: (_data, _error, variables) => {
      if (ownsEmailMutation(variables)) return queryClient.invalidateQueries({ queryKey: key });
    },
  });
  return exposeOwnedEmailMutation(owner, mutation);
}
