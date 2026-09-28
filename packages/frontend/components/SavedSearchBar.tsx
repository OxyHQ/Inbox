import {
  useCreateSavedSearch,
  useDeleteSavedSearch,
} from '@/hooks/mutations/useSavedSearchMutations';
import { useSavedSearches } from '@/hooks/queries/useSavedSearches';
import type { SavedEmailSearchFilters } from '@/services/emailApi';
import { Chip } from '@oxy.so/bloom/chip';
import { Text } from '@oxy.so/bloom/typography';
import { Button } from '@oxy.so/bloom/button';
import { TextFieldInput } from '@oxy.so/bloom/text-field';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

interface SavedSearchBarProps {
  query: string;
  filters: SavedEmailSearchFilters;
  enabled: boolean;
  onApply: (search: {
    query: string;
    filters: SavedEmailSearchFilters;
  }) => void;
}

export function SavedSearchBar({
  query,
  filters,
  enabled,
  onApply,
}: SavedSearchBarProps) {
  const { data: savedSearches = [] } = useSavedSearches();
  const createSavedSearch = useCreateSavedSearch();
  const deleteSavedSearch = useDeleteSavedSearch();
  const [name, setName] = useState('');

  const handleSave = useCallback(() => {
    const trimmedName = name.trim();
    if (!enabled || !trimmedName) return;
    createSavedSearch.mutate(
      { name: trimmedName, query: query.trim(), filters },
      { onSuccess: () => setName('') },
    );
  }, [createSavedSearch, enabled, filters, name, query]);

  return (
    <View className="gap-2 px-4 pb-2" accessibilityLiveRegion="polite">
      {savedSearches.length > 0 ? (
        <View className="flex-row flex-wrap items-center gap-2">
          <Text variant="caption-1-regular">Saved</Text>
          {savedSearches.map((saved) => (
            <Chip
              key={saved.id}
              onPress={() => onApply(saved)}
              accessibilityLabel={`Run saved search ${saved.name}`}
              onClose={() => deleteSavedSearch.mutate(saved.id)}
              closeLabel={`Delete saved search ${saved.name}`}
            >
              {saved.name}
            </Chip>
          ))}
        </View>
      ) : null}
      {enabled ? (
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <TextFieldInput
              value={name}
              onChangeText={setName}
              label="Saved search name"
              placeholder="Name this search"
              maxLength={100}
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
          </View>
          <Button
            onPress={handleSave}
            disabled={!name.trim() || createSavedSearch.isPending}
            loading={createSavedSearch.isPending}
          >
            Save
          </Button>
        </View>
      ) : null}
    </View>
  );
}
