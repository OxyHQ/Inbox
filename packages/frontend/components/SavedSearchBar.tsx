import { Button } from '@oxy.so/bloom/button';
import { TextFieldInput } from '@oxy.so/bloom/text-field';
import React, { useState, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useColors } from '@/constants/theme';
import { useSavedSearches } from '@/hooks/queries/useSavedSearches';
import { useCreateSavedSearch, useDeleteSavedSearch } from '@/hooks/mutations/useSavedSearchMutations';
import type { SavedEmailSearchFilters } from '@/services/emailApi';

interface SavedSearchBarProps {
  query: string;
  filters: SavedEmailSearchFilters;
  enabled: boolean;
  onApply: (search: { query: string; filters: SavedEmailSearchFilters }) => void;
}

export function SavedSearchBar({ query, filters, enabled, onApply }: SavedSearchBarProps) {
  const colors = useColors();
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
    <View style={styles.container} accessibilityLiveRegion="polite">
      {savedSearches.length > 0 ? (
        <View style={styles.savedRow}>
          <Text style={[styles.label, { color: colors.secondaryText }]}>Saved</Text>
          {savedSearches.map((saved) => (
            <View key={saved.id} style={[styles.savedChip, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Pressable
                onPress={() => onApply(saved)}
                accessibilityRole="button"
                accessibilityLabel={`Run saved search ${saved.name}`}
                style={styles.savedChipAction}
              >
                <Text style={[styles.savedChipText, { color: colors.text }]} numberOfLines={1}>{saved.name}</Text>
              </Pressable>
              <Pressable
                onPress={() => deleteSavedSearch.mutate(saved.id)}
                accessibilityRole="button"
                accessibilityLabel={`Delete saved search ${saved.name}`}
                hitSlop={6}
              >
                <MaterialCommunityIcons name="close" size={14} color={colors.secondaryText} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {enabled ? (
        <View style={styles.saveRow}>
          <View style={{ flex: 1 }}><TextFieldInput value={name} onChangeText={setName} label="Saved search name" placeholder="Name this search" maxLength={100} returnKeyType="done" onSubmitEditing={handleSave} /></View>
          <Button onPress={handleSave} disabled={!name.trim() || createSavedSearch.isPending} loading={createSavedSearch.isPending}>Save</Button>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  savedRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  label: { fontSize: 12, fontWeight: '600' },
  savedChip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingLeft: 10, paddingRight: 8, minHeight: 30, maxWidth: 220 },
  savedChipAction: { paddingVertical: 5, paddingRight: 5 },
  savedChipText: { fontSize: 12, maxWidth: 170 },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
