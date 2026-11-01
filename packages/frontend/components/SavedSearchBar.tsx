import {
  useCreateSavedSearch,
  useDeleteSavedSearch,
} from '@/hooks/mutations/useSavedSearchMutations';
import {
  isCurrentEmailOwner,
  matchesCurrentEmailMutation,
  type OwnedVariables,
  useEmailMutationOwner,
} from '@/hooks/mutations/ownedEmailMutation';
import { SAVED_SEARCH_MUTATION_KEYS } from '@/hooks/queries/queryKeys';
import { useSavedSearches } from '@/hooks/queries/useSavedSearches';
import { useTranslation } from '@/lib/i18n';
import type { SavedEmailSearchFilters } from '@/services/emailApi';
import { Button } from '@oxy.so/bloom/button';
import { Chip } from '@oxy.so/bloom/chip';
import { Dialog } from '@oxy.so/bloom/dialog';
import { RiBookmarkLine } from '@oxy.so/bloom/icons/RiBookmarkLine';
import { TextFieldInput } from '@oxy.so/bloom/text-field';
import { Text } from '@oxy.so/bloom/typography';
import {
  onlineManager,
  type QueryClient,
  useIsMutating,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';

interface SavedSearchBarProps {
  query: string;
  filters: SavedEmailSearchFilters;
  enabled: boolean;
  onApply: (search: { query: string; filters: SavedEmailSearchFilters }) => void;
}

type MutationOwner = ReturnType<typeof useEmailMutationOwner>;

function hasPendingMutation(
  client: QueryClient,
  key: readonly unknown[],
  owner: MutationOwner,
): boolean {
  return client
    .getMutationCache()
    .findAll({ mutationKey: key, exact: true, status: 'pending' })
    .some((mutation) => {
      const variables = mutation.state.variables;
      return (
        variables !== null &&
        typeof variables === 'object' &&
        matchesCurrentEmailMutation(variables as OwnedVariables<unknown>, owner)
      );
    });
}

export function SavedSearchBar({ query, filters, enabled, onApply }: SavedSearchBarProps) {
  const { t } = useTranslation();
  const online = useSyncExternalStore(
    onlineManager.subscribe,
    () => onlineManager.isOnline(),
    () => onlineManager.isOnline(),
  );
  const { data, isError, fetchStatus } = useSavedSearches();
  const savedSearches = data ?? [];
  const paused = fetchStatus === 'paused';
  const showStatus = paused || isError;
  const status = paused
    ? online
      ? t('search.saved.retryPaused')
      : data === undefined
        ? t('search.saved.offlineEmpty')
        : t('search.saved.offlineCached')
    : data === undefined
      ? t('search.saved.loadFailed')
      : t('search.saved.refreshFailed');
  const createSavedSearch = useCreateSavedSearch();
  const deleteSavedSearch = useDeleteSavedSearch();
  const owner = useEmailMutationOwner(true);
  const queryClient = useQueryClient();
  // Subscribe to mutation changes; derive visibility against this render's owner.
  useIsMutating({ mutationKey: SAVED_SEARCH_MUTATION_KEYS.create, exact: true });
  useIsMutating({ mutationKey: SAVED_SEARCH_MUTATION_KEYS.delete, exact: true });
  const saving = hasPendingMutation(queryClient, SAVED_SEARCH_MUTATION_KEYS.create, owner);
  const deleting = hasPendingMutation(queryClient, SAVED_SEARCH_MUTATION_KEYS.delete, owner);
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);
  const handleSave = useCallback(() => {
    const trimmedName = name.trim();
    if (
      !enabled ||
      !trimmedName ||
      saving ||
      !isCurrentEmailOwner(owner) ||
      hasPendingMutation(queryClient, SAVED_SEARCH_MUTATION_KEYS.create, owner)
    )
      return;
    createSavedSearch.mutate(
      { name: trimmedName, query: query.trim(), filters },
      {
        onSuccess: () => {
          setName('');
          setOpen(false);
        },
      },
    );
  }, [createSavedSearch, enabled, filters, name, owner, query, queryClient, saving]);

  const handleDelete = (id: string) => {
    if (
      !isCurrentEmailOwner(owner) ||
      hasPendingMutation(queryClient, SAVED_SEARCH_MUTATION_KEYS.delete, owner)
    )
      return;
    deleteSavedSearch.mutate(id);
  };

  return (
    <>
      {(savedSearches.length > 0 || enabled || showStatus) && (
        <View className="gap-2 px-4 pb-3">
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            {(savedSearches.length > 0 || showStatus) && (
              <Text variant="caption-1-medium">{t('search.ui.savedSearches')}</Text>
            )}
            {enabled && (
              <Button appearance="plain" leading={<RiBookmarkLine />} onPress={() => setOpen(true)}>
                {t('search.ui.saveSearch')}
              </Button>
            )}
          </View>
          {savedSearches.length > 0 && (
            <View className="flex-row flex-wrap gap-2">
              {savedSearches.map((saved) => (
                <Chip
                  tone="neutral"
                  appearance="outline"
                  key={saved.id}
                  onPress={() => onApply(saved)}
                  accessibilityLabel={t('search.ui.runSaved', {
                    name: saved.name,
                  })}
                  onClose={deleting ? undefined : () => handleDelete(saved.id)}
                  closeLabel={t('search.ui.deleteSaved', { name: saved.name })}
                  style={{ maxWidth: '100%' }}
                >
                  {saved.name}
                </Chip>
              ))}
            </View>
          )}
          {showStatus && (
            <View className="flex-row items-center gap-2">
              <View className="flex-1">
                <Text accessibilityLiveRegion="polite">{status}</Text>
              </View>
            </View>
          )}
          {deleting && <Text accessibilityLiveRegion="polite">{t('common.loading')}</Text>}
        </View>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        placement={{ base: 'bottom', md: 'center' }}
        title={t('search.ui.saveSearch')}
        description={t('search.ui.saveSearchDescription')}
        actions={[
          {
            label: t('common.cancel'),
            color: 'cancel',
            disabled: saving,
          },
          {
            label: t('common.save'),
            onPress: handleSave,
            disabled: !enabled || !name.trim() || saving,
            shouldCloseOnPress: false,
          },
        ]}
        testID="save-search-dialog"
      >
        <TextFieldInput
          value={name}
          onChangeText={setName}
          label={t('search.ui.searchName')}
          maxLength={100}
          returnKeyType="done"
          onSubmitEditing={handleSave}
          autoFocus
        />
      </Dialog>
    </>
  );
}
