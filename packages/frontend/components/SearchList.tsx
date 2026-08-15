/**
 * Search emails list with Gmail-style search bar and filter chips.
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSearchFocus } from '@/contexts/search-focus-context';
import { useFloatingHeader } from '@/hooks/useFloatingHeader';
import { useGoBack } from '@/hooks/useGoBack';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { useTranslation } from '@/lib/i18n';

import { useColors } from '@/constants/theme';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { useInboxDisplayPrefs } from '@/hooks/useInboxDisplayPrefs';
import { SPECIAL_USE } from '@/constants/mailbox';
import type { Message, SavedEmailSearchFilters } from '@/services/emailApi';
import { MessageRow } from '@/components/MessageRow';
import { SearchHeader } from '@/components/SearchHeader';
import { SavedSearchBar } from '@/components/SavedSearchBar';
import { EmptyIllustration } from '@/components/EmptyIllustration';
import { useEmailStore } from '@/hooks/useEmail';
import { useOxy } from '@oxyhq/services';
import { useRecentSearches } from '@/hooks/useRecentSearches';
import { recordInboxMetric } from '@/utils/inboxTelemetry';
import { useSearchMessages } from '@/hooks/queries/useSearchMessages';
import { useMessageActions } from '@/hooks/useMessageActions';
import { useMailboxes } from '@/hooks/queries/useMailboxes';
import {
  useNaturalLanguageSearch,
  quickParseSearch,
  type ParsedSearchQuery,
} from '@/hooks/queries/useNaturalLanguageSearch';
import {
  collapseThreads,
  formatSearchInterpretation,
  parseSearchQuery,
} from '@/utils/threadGrouping';

interface SearchListProps {
  replaceNavigation?: boolean;
}

export function SearchList({ replaceNavigation }: SearchListProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const colors = useColors();
  const { t } = useTranslation();
  const { density, showAvatars, showPreviews } = useInboxDisplayPrefs();
  const inputRef = useRef<TextInput | null>(null);
  const { registerInput } = useSearchFocus();
  // Fans the input node out to BOTH the local ref (used by `handleClear` to
  // put the caret back) and the shared context the tab bar focuses through.
  // A callback ref rather than an effect: it runs during commit and is called
  // with null on unmount, so registration cannot outlive the input.
  const setInputRef = useCallback(
    (node: TextInput | null) => {
      inputRef.current = node;
      registerInput(node);
    },
    [registerInput],
  );
  const selectedMessageId = useEmailStore((s) => s.selectedMessageId);
  const { user } = useOxy();
  const { recentSearches, remember: rememberSearch, clear: clearRecentSearches } = useRecentSearches(user?.id);
  const messageActions = useMessageActions();
  const { data: mailboxes = [] } = useMailboxes();

  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterHasAttachment, setFilterHasAttachment] = useState(false);
  // Measured height of the floating header stack, reused as the list's top
  // padding so the first result starts just below it.
  const { headerHeight, onHeaderLayout, floatingHeaderStyle } = useFloatingHeader();
  const [editingFilter, setEditingFilter] = useState<string | null>(null);
  const [filterInput, setFilterInput] = useState('');
  const [nlInterpretation, setNlInterpretation] = useState('');
  const [nlParsedOptions, setNlParsedOptions] = useState<ParsedSearchQuery | null>(null);
  const searchRunIdRef = useRef(0);

  // Natural language search hook
  const { parseQuery: parseNL, isLoading: nlParsing } = useNaturalLanguageSearch();

  // Parse the submitted query for Gmail-style operators
  const parsedQuery = useMemo(() => parseSearchQuery(submittedQuery), [submittedQuery]);
  const requestedMailbox = nlParsedOptions?.mailbox ?? parsedQuery.mailbox;

  // Map mailbox name to mailbox ID
  const mailboxIdFromName = useMemo(() => {
    if (!requestedMailbox) return undefined;
    // Saved searches persist the resolved mailbox id. Keep accepting the
    // human-readable special-use names used by the parser as well.
    const existingMailbox = mailboxes.find((mailbox) => mailbox._id === requestedMailbox);
    if (existingMailbox) return existingMailbox._id;
    const specialUseMap: Record<string, string> = {
      inbox: SPECIAL_USE.INBOX,
      sent: SPECIAL_USE.SENT,
      drafts: SPECIAL_USE.DRAFTS,
      trash: SPECIAL_USE.TRASH,
      spam: SPECIAL_USE.SPAM,
      junk: SPECIAL_USE.SPAM,
      archive: SPECIAL_USE.ARCHIVE,
    };
    const specialUse = specialUseMap[requestedMailbox];
    if (specialUse) {
      const mailbox = mailboxes.find((m) => m.specialUse === specialUse);
      return mailbox?._id;
    }
    // Try to match by name
    const mailbox = mailboxes.find((m) => m.name.toLowerCase() === requestedMailbox);
    return mailbox?._id;
  }, [requestedMailbox, mailboxes]);

  const searchOptions = useMemo(() => ({
    // NL parsed options take precedence, then Gmail-style operators, then filter chips.
    q: nlParsedOptions?.q ?? (parsedQuery.text || undefined),
    from: nlParsedOptions?.from ?? parsedQuery.from ?? (filterFrom || undefined),
    to: nlParsedOptions?.to ?? parsedQuery.to,
    subject: nlParsedOptions?.subject ?? parsedQuery.subject,
    hasAttachment: nlParsedOptions?.hasAttachment ?? parsedQuery.hasAttachment ?? (filterHasAttachment || undefined),
    dateAfter: nlParsedOptions?.after ?? parsedQuery.after,
    dateBefore: nlParsedOptions?.before ?? parsedQuery.before,
    mailbox: mailboxIdFromName,
    starred: nlParsedOptions?.starred ?? parsedQuery.starred,
    unread: nlParsedOptions?.unread ?? parsedQuery.unread,
    // Labels are parsed from Gmail-style operators. The natural-language
    // result type intentionally has no label field.
    label: parsedQuery.label,
  }), [nlParsedOptions, parsedQuery, filterFrom, filterHasAttachment, mailboxIdFromName]);

  const {
    data: searchData,
    isLoading: searching,
    isError: searchFailed,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useSearchMessages(searchOptions);
  const messages = useMemo(
    () => {
      const seen = new Set<string>();
      return (
        searchData?.pages
          .flatMap((page) => page.data)
          .filter((message) => {
            if (seen.has(message._id)) return false;
            seen.add(message._id);
            return true;
          }) ?? []
      );
    },
    [searchData],
  );
  // Search pages are grouped only after they are merged. This avoids one row
  // per page and lets a related message loaded later update the same row.
  // The API still needs a server-side threadId for authoritative cross-page
  // grouping when a result set is incomplete.
  const results = useMemo(() => collapseThreads(messages), [messages]);
  const total = searchData?.pages[0]?.pagination.total ?? 0;
  const hasSearched = Boolean(
    submittedQuery.trim() ||
      nlParsedOptions ||
      filterFrom ||
      filterHasAttachment ||
      requestedMailbox,
  );
  const filterInterpretation = useMemo(
    () =>
      formatSearchInterpretation(
        nlParsedOptions ?? {
          ...parsedQuery,
          q: parsedQuery.text || undefined,
          from: parsedQuery.from || filterFrom || undefined,
          mailbox: requestedMailbox,
          hasAttachment: parsedQuery.hasAttachment ?? (filterHasAttachment || undefined),
        },
      ),
    [nlParsedOptions, parsedQuery, filterFrom, filterHasAttachment, requestedMailbox],
  );

  /**
   * Runs the search pipeline for a given query text:
   *   1. Gmail-style operators (`from:foo`, `is:starred`) → text + filter parse.
   *   2. Quick patterns (`unread`, `from sarah`) → structured filters.
   *   3. Plain text search immediately, then optionally refined by AI.
   *
   * Accepts the text as a parameter so debounced callers can pass the latest
   * value without waiting for React state to settle.
   */
  const runSearch = useCallback(
    async (rawText: string, { allowAI }: { allowAI: boolean } = { allowAI: true }) => {
      const searchRunId = ++searchRunIdRef.current;
      const trimmed = rawText.trim();
      if (!trimmed) {
        setSubmittedQuery('');
        setNlInterpretation('');
        setNlParsedOptions(null);
        return;
      }

      const parsedOperators = parseSearchQuery(trimmed);
      const hasOperators = Object.entries(parsedOperators).some(
        ([key, value]) => key !== 'text' && value !== undefined,
      );
      if (hasOperators) {
        setSubmittedQuery(trimmed);
        setNlInterpretation('');
        setNlParsedOptions(null);
        return;
      }

      const quickResult = quickParseSearch(trimmed);
      if (quickResult) {
        setNlParsedOptions(quickResult);
        setNlInterpretation(`Searching: ${formatSearchInterpretation(quickResult)}`);
        setSubmittedQuery('');
        return;
      }

      // Run plain text search immediately so the user sees results without
      // waiting for AI parsing.
      setSubmittedQuery(trimmed);
      setNlInterpretation('');
      setNlParsedOptions(null);

      if (!allowAI) return;

      // Refine with AI in the background. Only switch from plain text to
      // structured filters if the AI returns something useful.
      try {
        const result = await parseNL(trimmed);
        if (searchRunId !== searchRunIdRef.current) return;
        const parsed = result.query;
        const hasUsefulFilters =
          !!parsed.q?.trim() ||
          !!parsed.from?.trim() ||
          !!parsed.to?.trim() ||
          !!parsed.subject?.trim() ||
          parsed.hasAttachment === true ||
          parsed.starred === true ||
          typeof parsed.unread === 'boolean' ||
          !!parsed.after ||
          !!parsed.before ||
          !!parsed.mailbox;

        if (hasUsefulFilters) {
          setNlParsedOptions(parsed);
          setNlInterpretation(
            result.interpretation || `Searching: ${formatSearchInterpretation(parsed)}`,
          );
          setSubmittedQuery('');
        }
      } catch (error) {
        if (searchRunId === searchRunIdRef.current && error instanceof Error) {
          setNlInterpretation('');
        }
        // AI failed; plain text search is already in flight.
      }
    },
    [parseNL],
  );

  // Debounced search-as-you-type. The user pressing Enter submits immediately.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQueryChange = useCallback(
    (text: string) => {
      searchRunIdRef.current += 1;
      setQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const trimmed = text.trim();
      if (!trimmed) {
        // Clear immediately when the user empties the input
        setSubmittedQuery('');
        setNlInterpretation('');
        setNlParsedOptions(null);
        return;
      }
      // Skip AI on intermediate keystrokes — AI fires on explicit submit
      debounceRef.current = setTimeout(() => {
        runSearch(text, { allowAI: false });
      }, 300);
    },
    [runSearch],
  );

  const handleSubmit = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const trimmed = query.trim();
    if (!trimmed) return;
    rememberSearch(trimmed);
    recordInboxMetric('search_submitted', {
      hasQuery: true,
      hasOperators: /\b(?:from|to|subject|in|is|has|label|after|before):/i.test(trimmed),
    });
    runSearch(query, { allowAI: true });
  }, [rememberSearch, runSearch, query]);

  const handleMessagePress = useCallback(
    (messageId: string) => {
      messageActions.prepareOpenMessage(messageId);
      const path = {
        pathname: '/search/conversation/[id]',
        params: { id: messageId },
      } as const;
      if (replaceNavigation) {
        router.replace(path);
      } else {
        router.push(path);
      }
    },
    [router, replaceNavigation, messageActions],
  );

  const handleBack = useGoBack();

  const handleClear = useCallback(() => {
    searchRunIdRef.current += 1;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setQuery('');
    setSubmittedQuery('');
    setFilterFrom('');
    setFilterHasAttachment(false);
    setNlInterpretation('');
    setNlParsedOptions(null);
    inputRef.current?.focus();
  }, []);

  const handleFilterChipPress = useCallback((filter: string) => {
    if (filter === 'attachment') {
      setFilterHasAttachment((v) => !v);
    } else {
      setEditingFilter(filter);
      setFilterInput(filter === 'from' ? filterFrom : '');
    }
  }, [filterFrom]);

  const handleFilterSubmit = useCallback(() => {
    if (editingFilter === 'from') {
      setFilterFrom(filterInput.trim());
    }
    setEditingFilter(null);
    setFilterInput('');
  }, [editingFilter, filterInput]);

  const handleApplySavedSearch = useCallback((saved: { query: string; filters: SavedEmailSearchFilters }) => {
    setQuery(saved.query);
    setFilterFrom(saved.filters.from ?? '');
    setFilterHasAttachment(saved.filters.hasAttachment ?? false);
    setSubmittedQuery('');
    setNlParsedOptions({
      q: saved.filters.q,
      from: saved.filters.from,
      to: saved.filters.to,
      subject: saved.filters.subject,
      hasAttachment: saved.filters.hasAttachment,
      starred: saved.filters.starred,
      unread: saved.filters.unread,
      after: saved.filters.dateAfter,
      before: saved.filters.dateBefore,
      mailbox: saved.filters.mailbox,
    });
    setNlInterpretation('');
  }, []);

  const listExtraData = useMemo(
    () => ({
      selectedMessageId,
      density,
      showAvatars,
      showPreviews,
      themeKey: `${colors.unread}|${colors.surface}|${colors.secondaryText}|${colors.primary}|${colors.border}`,
    }),
    [selectedMessageId, density, showAvatars, showPreviews, colors.unread, colors.surface, colors.secondaryText, colors.primary, colors.border],
  );

  const renderItem = useCallback(
    ({ item }: { item: Message }) => (
      <MessageRow
        message={item}
        onSelect={handleMessagePress}
        isSelected={item._id === selectedMessageId}
        density={density}
        showAvatars={showAvatars}
        showPreviews={showPreviews}
      />
    ),
    [handleMessagePress, selectedMessageId, density, showAvatars, showPreviews],
  );

  const handleEndReached = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage || searching) return;
    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, searching]);

  const handleRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  const renderEmpty = useCallback(() => {
    if (searching) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }
    if (!hasSearched) {
      return (
        <View style={styles.emptyContainer}>
          <EmptyIllustration size={180} />
          <Text style={[styles.emptyText, { color: colors.secondaryText }]}>
            {t('search.empty.idle')}
          </Text>
          {recentSearches.length > 0 && (
            <View style={styles.recentSearches}>
              {recentSearches.map((recent) => (
                <TouchableOpacity
                  key={recent}
                  accessibilityLabel={recent}
                  accessibilityRole="button"
                  style={[styles.recentSearch, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  onPress={() => {
                    setQuery(recent);
                    void runSearch(recent, { allowAI: false });
                  }}
                >
                  <Text style={[styles.recentSearchText, { color: colors.text }]} numberOfLines={1}>{recent}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity accessibilityLabel={t('search.clear')} onPress={clearRecentSearches}>
                <Text style={[styles.clearRecentText, { color: colors.primary }]}>{t('search.clear')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    }
    if (searchFailed) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={colors.secondaryText} />
          <Text style={[styles.emptyText, { color: colors.secondaryText }]}>{t('common.error')}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { borderColor: colors.border }]}
            onPress={handleRetry}
            activeOpacity={0.7}
          >
            <Text style={[styles.retryButtonText, { color: colors.primary }]}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <EmptyIllustration size={180} />
        <Text style={[styles.emptyText, { color: colors.secondaryText }]}>{t('search.empty.noResults')}</Text>
      </View>
    );
  }, [clearRecentSearches, colors, handleRetry, hasSearched, recentSearches, runSearch, searchFailed, searching, t]);

  const renderFooter = useCallback(() => {
    if (isFetchingNextPage) {
      return (
        <View style={styles.footerLoading}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      );
    }
    if (searchFailed && results.length > 0) {
      return (
        <View style={styles.footerError}>
          <Text style={[styles.footerErrorText, { color: colors.secondaryText }]}>{t('common.error')}</Text>
          <TouchableOpacity accessibilityLabel={t('common.retry')} onPress={handleRetry} hitSlop={8}>
            <Text style={[styles.retryButtonText, { color: colors.primary }]}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return null;
  }, [colors, handleRetry, isFetchingNextPage, results.length, searchFailed, t]);

  const visibleInterpretation = nlInterpretation ||
    (hasSearched && !nlParsing ? `Searching: ${filterInterpretation}` : '');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Same scroll treatment as the inbox: the header (and the filter chips
          under it) float over the results, which scroll behind the header's
          gradient. The measured height becomes the list's top padding. */}
      <View style={floatingHeaderStyle} onLayout={onHeaderLayout}
      >
      <SearchHeader
        ref={setInputRef}
        onLeftIcon={handleBack}
        leftIcon="arrow-left"
        placeholder={t('search.placeholder')}
        value={query}
        onChangeText={handleQueryChange}
        onSubmitEditing={handleSubmit}
        onClear={handleClear}
        autoFocus
      />

      {/* Filter chips */}
      <View
        style={[
          styles.filterBar,
          { paddingLeft: 16 + insets.left, paddingRight: 16 + insets.right },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.filterChip,
            { borderColor: colors.border },
            filterFrom ? { backgroundColor: colors.primary + '15', borderColor: colors.primary } : undefined,
          ]}
          onPress={() => handleFilterChipPress('from')}
          accessibilityLabel={filterFrom ? t('search.filters.fromValue', { value: filterFrom }) : t('search.filters.from')}
          accessibilityRole="button"
          activeOpacity={0.7}
        >
          <Text style={[styles.filterChipText, { color: filterFrom ? colors.primary : colors.secondaryText }]}>
            {filterFrom ? t('search.filters.fromValue', { value: filterFrom }) : t('search.filters.from')}
          </Text>
          {filterFrom ? (
            <TouchableOpacity onPress={() => setFilterFrom('')} hitSlop={4}>
              <MaterialCommunityIcons name="close-circle" size={14} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterChip,
            { borderColor: colors.border },
            filterHasAttachment ? { backgroundColor: colors.primary + '15', borderColor: colors.primary } : undefined,
          ]}
          onPress={() => handleFilterChipPress('attachment')}
          accessibilityLabel={t('search.filters.hasAttachment')}
          accessibilityRole="button"
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="paperclip"
            size={14}
            color={filterHasAttachment ? colors.primary : colors.secondaryText}
          />
          <Text style={[styles.filterChipText, { color: filterHasAttachment ? colors.primary : colors.secondaryText }]}>
            {t('search.filters.hasAttachment')}
          </Text>
        </TouchableOpacity>
      </View>

      <SavedSearchBar
        query={query}
        filters={searchOptions}
        enabled={hasSearched}
        onApply={handleApplySavedSearch}
      />

      {/* Search interpretation display. AI is only requested on explicit submit;
          normal operator searches are rendered from the same parsed options. */}
      {(visibleInterpretation || nlParsing) && (
        <View
          style={[
            styles.nlInterpretation,
            {
              backgroundColor: colors.surfaceVariant,
              marginLeft: 16 + insets.left,
              marginRight: 16 + insets.right,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={nlParsing ? 'robot-outline' : 'tune-variant'}
            size={14}
            color={colors.primary}
            style={styles.nlIcon}
          />
          {nlParsing ? (
            <View style={styles.nlParsingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.nlText, { color: colors.secondaryText }]}>
                {t('search.nl.understanding')}
              </Text>
            </View>
          ) : (
            <Text style={[styles.nlText, { color: colors.text }]}>
              {visibleInterpretation}
            </Text>
          )}
          {nlInterpretation && !nlParsing && (
            <TouchableOpacity
              onPress={() => {
                setNlInterpretation('');
                setNlParsedOptions(null);
                setSubmittedQuery(query.trim());
              }}
              hitSlop={8}
            >
              <MaterialCommunityIcons name="close" size={16} color={colors.icon} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Filter input overlay */}
      {editingFilter && (
        <View style={[styles.filterInputRow, { backgroundColor: colors.surfaceVariant }]}>
          <Text style={[styles.filterInputLabel, { color: colors.secondaryText }]}>
            {editingFilter === 'from' ? 'From:' : editingFilter}
          </Text>
          <TextInput
            style={[styles.filterInputField, { color: colors.text }]}
            value={filterInput}
            onChangeText={setFilterInput}
            autoFocus
            onSubmitEditing={handleFilterSubmit}
            returnKeyType="done"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity onPress={() => setEditingFilter(null)}>
            <MaterialCommunityIcons name="close" size={20} color={colors.icon} />
          </TouchableOpacity>
        </View>
      )}

      {/* Result count */}
      {hasSearched && !searching && results.length > 0 && (
        <View style={styles.resultCount}>
          <Text style={[styles.resultCountText, { color: colors.secondaryText }]}>
            {t('search.results', { count: total })}
          </Text>
        </View>
      )}
      </View>

      {searching ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={results}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          extraData={listExtraData}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          contentContainerStyle={{
            ...(results.length === 0 ? styles.emptyListContent : null),
            ...styles.listContent,
            paddingTop: headerHeight,
            // The floating tab bar's footprint, which already folds in the
            // bottom safe-area inset — so the last result row clears both the
            // bar and the home indicator, on every platform.
            paddingBottom: tabBarClearance,
          }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  // `paddingLeft` / `paddingRight` are applied inline so they can include
  // landscape `insets.left` / `insets.right`.
  filterBar: {
    flexDirection: 'row',
    paddingBottom: 8,
    gap: 8,
    flexWrap: 'wrap',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  filterInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterInputLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterInputField: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 4,
  },
  resultCount: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  resultCountText: {
    fontSize: 12,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    paddingTop: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 120,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
  },
  recentSearches: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'stretch',
    gap: 8,
    paddingHorizontal: 24,
  },
  recentSearch: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 20,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  recentSearchText: {
    fontSize: 14,
  },
  clearRecentText: {
    alignSelf: 'center',
    fontSize: 13,
    fontWeight: '600',
  },
  retryButton: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyListContent: {
    flexGrow: 1,
  },
  footerLoading: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  footerError: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 16,
  },
  footerErrorText: {
    fontSize: 13,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 68,
  },
  // `marginLeft` / `marginRight` are applied inline so they can include
  // landscape `insets.left` / `insets.right`.
  nlInterpretation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  nlIcon: {
    marginRight: 4,
  },
  nlText: {
    flex: 1,
    fontSize: 13,
  },
  nlParsingRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
