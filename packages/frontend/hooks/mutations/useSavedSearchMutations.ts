import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@oxy.so/bloom/toast';
import { emailKeys, SAVED_SEARCH_MUTATION_KEYS } from '@/hooks/queries/queryKeys';
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
type CreateSavedSearchInput = { name: string; query: string; filters: SavedEmailSearchFilters };

async function reconcile<T>(
  queryClient: ReturnType<typeof useQueryClient>,
  variables: OwnedVariables<T>,
) {
  if (!ownsEmailMutation(variables)) return;
  await queryClient.cancelQueries({ queryKey: key });
  if (!ownsEmailMutation(variables)) return;
  await queryClient.invalidateQueries({ queryKey: key });
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
    mutationKey: SAVED_SEARCH_MUTATION_KEYS.create,
    mutationFn: async (variables) => emailMutationApi(variables).createSavedSearch(variables.input),
    onError: (error, variables) => {
      if (!ownsEmailMutation(variables)) return;
      toast.error(error instanceof Error ? error.message : t('search.saved.saveFailed'));
    },
    onSettled: (_data, _error, variables) => {
      return reconcile(queryClient, variables);
    },
  });
  return exposeOwnedEmailMutation(owner, mutation);
}

export function useDeleteSavedSearch() {
  const owner = useEmailMutationOwner(true);
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const mutation = useMutation<void, Error, OwnedVariables<string>, EmailMutationContext>({
    mutationKey: SAVED_SEARCH_MUTATION_KEYS.delete,
    mutationFn: async (variables) => emailMutationApi(variables).deleteSavedSearch(variables.input),
    onError: (error, variables) => {
      if (!ownsEmailMutation(variables)) return;
      toast.error(error instanceof Error ? error.message : t('search.saved.deleteFailed'));
    },
    onSettled: (_data, _error, variables) => {
      return reconcile(queryClient, variables);
    },
  });
  return exposeOwnedEmailMutation(owner, mutation);
}
