import React, { useState, useCallback } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Name this search"
            placeholderTextColor={colors.secondaryText}
            accessibilityLabel="Saved search name"
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            maxLength={100}
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />
          <Pressable
            onPress={handleSave}
            disabled={!name.trim() || createSavedSearch.isPending}
            accessibilityRole="button"
            accessibilityLabel="Save search"
            style={[styles.saveButton, { backgroundColor: colors.primary }, (!name.trim() || createSavedSearch.isPending) && styles.disabled]}
          >
            <MaterialCommunityIcons name="bookmark-plus-outline" size={16} color="#fff" />
            <Text style={styles.saveButtonText}>Save</Text>
          </Pressable>
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
  input: { flex: 1, minHeight: 36, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13 },
  saveButton: { minHeight: 36, borderRadius: 8, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 5 },
  saveButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  disabled: { opacity: 0.45 },
});
