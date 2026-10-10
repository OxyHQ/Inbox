import {
  useCreateSavedSearch,
  useDeleteSavedSearch,
} from '@/hooks/mutations/useSavedSearchMutations';
import { useSavedSearches } from '@/hooks/queries/useSavedSearches';
import { useTranslation } from '@/lib/i18n';
import type { SavedEmailSearchFilters } from '@/services/emailApi';
import { Button } from '@oxy.so/bloom/button';
import { Chip } from '@oxy.so/bloom/chip';
import { Dialog } from '@oxy.so/bloom/dialog';
import { RiBookmarkLine } from '@oxy.so/bloom/icons';
import { TextFieldInput } from '@oxy.so/bloom/text-field';
import { Text } from '@oxy.so/bloom/typography';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

interface SavedSearchBarProps {
  query: string;
  filters: SavedEmailSearchFilters;
  enabled: boolean;
  onApply: (search: { query: string; filters: SavedEmailSearchFilters }) => void;
}

export function SavedSearchBar({ query, filters, enabled, onApply }: SavedSearchBarProps) {
  const { t } = useTranslation();
  const { data: savedSearches = [] } = useSavedSearches();
  const createSavedSearch = useCreateSavedSearch();
  const deleteSavedSearch = useDeleteSavedSearch();
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);
  const handleSave = useCallback(() => {
    const trimmedName = name.trim();
    if (!enabled || !trimmedName || createSavedSearch.isPending) return;
    createSavedSearch.mutate(
      { name: trimmedName, query: query.trim(), filters },
      {
        onSuccess: () => {
          setName('');
          setOpen(false);
        },
      },
    );
  }, [createSavedSearch, enabled, filters, name, query]);

  return (
    <>
      {(savedSearches.length > 0 || enabled) && (
        <View className="gap-2 px-4 pb-3">
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            {savedSearches.length > 0 && (
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
                  onClose={() => deleteSavedSearch.mutate(saved.id)}
                  closeLabel={t('search.ui.deleteSaved', { name: saved.name })}
                  style={{ maxWidth: '100%' }}
                >
                  {saved.name}
                </Chip>
              ))}
            </View>
          )}
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
            disabled: createSavedSearch.isPending,
          },
          {
            label: t('common.save'),
            onPress: handleSave,
            disabled: !enabled || !name.trim() || createSavedSearch.isPending,
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
