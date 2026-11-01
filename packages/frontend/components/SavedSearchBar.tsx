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
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';

interface SavedSearchBarProps {
  query: string;
  filters: SavedEmailSearchFilters;
  enabled: boolean;
  scope: object;
  isScopeCurrent: () => boolean;
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

export function SavedSearchBar({
  query,
  filters,
  enabled,
  scope,
  isScopeCurrent,
  onApply,
}: SavedSearchBarProps) {
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
  const [pending, setPending] = useState<{
    id: object;
    scope: object;
    isCurrent: () => boolean;
    name: string;
  } | null>(null);
  const pendingRef = useRef(pending);
  const closedDraftRef = useRef<{ scope: object; name: string } | null>(null);
  useLayoutEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  const draft = pending?.scope === scope ? pending : null;
  const closeDraft = () => {
    if (!isScopeCurrent()) return;
    const id = pending?.id;
    const current = pendingRef.current;
    if (current && current.id === id) {
      closedDraftRef.current = { scope: current.scope, name: current.name };
      pendingRef.current = null;
    }
    setPending((current) => (current?.id === id ? null : current));
  };
  const handleSave = () => {
    const current = pendingRef.current;
    const trimmedName = current?.name.trim();
    if (
      !draft ||
      !current ||
      current.id !== draft.id ||
      current.scope !== scope ||
      !current.isCurrent() ||
      !isScopeCurrent() ||
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
          if (!current.isCurrent() || pendingRef.current !== current) return;
          pendingRef.current = null;
          if (closedDraftRef.current?.scope === scope) closedDraftRef.current = null;
          setPending((value) => (value?.id === current.id ? null : value));
        },
      },
    );
  };

  const handleDelete = (id: string) => {
    if (
      !isScopeCurrent() ||
      !isCurrentEmailOwner(owner) ||
      hasPendingMutation(queryClient, SAVED_SEARCH_MUTATION_KEYS.delete, owner)
    )
      return;
    deleteSavedSearch.mutate(id);
  };

  return (
    <>
      {(savedSearches.length > 0 || enabled || showStatus || saving || deleting) && (
        <View className="gap-2 px-4 pb-3">
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            {(savedSearches.length > 0 || showStatus) && (
              <Text variant="caption-1-medium">{t('search.ui.savedSearches')}</Text>
            )}
            {enabled && (
              <Button
                appearance="plain"
                leading={<RiBookmarkLine />}
                onPress={() => {
                  if (!isScopeCurrent() || pendingRef.current) return;
                  const name =
                    closedDraftRef.current?.scope === scope ? closedDraftRef.current.name : '';
                  const next = { id: {}, scope, isCurrent: isScopeCurrent, name };
                  pendingRef.current = next;
                  setPending(next);
                }}
              >
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
                  onPress={() => {
                    if (isScopeCurrent()) onApply(saved);
                  }}
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
          {(saving || deleting) && (
            <Text accessibilityLiveRegion="polite">{t('common.loading')}</Text>
          )}
        </View>
      )}
      <Dialog
        open={pending !== null}
        onClose={closeDraft}
        placement={{ base: 'bottom', md: 'center' }}
        title={t('search.ui.saveSearch')}
        description={t('search.ui.saveSearchDescription')}
        actions={[
          {
            label: t('common.close'),
            color: 'cancel',
          },
          {
            label: t('common.save'),
            onPress: handleSave,
            disabled: !draft || !enabled || !draft.name.trim() || saving,
            shouldCloseOnPress: false,
          },
        ]}
        testID="save-search-dialog"
      >
        {pending && !draft && (
          <Text accessibilityLiveRegion="polite">{t('search.ui.savedDraftUnavailable')}</Text>
        )}
        {draft && (
          <TextFieldInput
            value={draft.name}
            onChangeText={(name) => {
              const current = pendingRef.current;
              if (
                !isScopeCurrent() ||
                !current ||
                current.scope !== scope ||
                current.id !== draft.id
              )
                return;
              const next = { ...current, name };
              pendingRef.current = next;
              setPending(next);
            }}
            label={t('search.ui.searchName')}
            maxLength={100}
            returnKeyType="done"
            onSubmitEditing={handleSave}
            autoFocus
          />
        )}
      </Dialog>
    </>
  );
}
