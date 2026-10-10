import { SearchFiltersBar } from '@/components/SearchFiltersBar';
import {
  hasSearchCriteria,
  pickSearchFilters,
  searchDateBound,
  type SearchFilters,
} from '@/utils/searchFilters';
import { BREAKPOINTS } from '@oxy.so/bloom/styles';
import { useBottomEdgeInset } from '@oxy.so/bloom/layout';
import { Divider } from '@oxy.so/bloom/divider';
import { useMailboxScrollRestoration } from '@/hooks/useMailboxScrollRestoration';
/**
 * Search emails list with Gmail-style search bar and filter chips.
 */

import { useSearchFocus } from '@/contexts/search-focus-context';
import { useSearchSessionState } from '@/contexts/search-session-context';
import { useGoBack } from '@/hooks/useGoBack';
import { useLabels } from '@/hooks/queries/useLabels';
import { useTranslation } from '@/lib/i18n';
import { Button, IconButton } from '@oxy.so/bloom/button';
import { EmptyState } from '@oxy.so/bloom/empty-state';
import { RiCloseLine } from '@oxy.so/bloom/icons';
import { Loading } from '@oxy.so/bloom/loading';
import { Text } from '@oxy.so/bloom/typography';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  useWindowDimensions,
  type FlatList,
  StyleSheet,
  type TextInput,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';

import { EmptyStateSticker } from '@/components/EmptyStateSticker';
import { MessageRow } from '@/components/MessageRow';
import { SavedSearchBar } from '@/components/SavedSearchBar';
import { SearchHeader } from '@/components/SearchHeader';
import { UnreadableMessageRow } from '@/components/UnreadableMessageRow';
import { SPACING } from '@/constants/layout';
import { SPECIAL_USE } from '@/constants/mailbox';
import { useColors } from '@/constants/theme';
import { useMailboxes } from '@/hooks/queries/useMailboxes';
import {
  quickParseSearch,
  useNaturalLanguageSearch,
} from '@/hooks/queries/useNaturalLanguageSearch';
import { useSearchMessages } from '@/hooks/queries/useSearchMessages';
import { useEmailStore } from '@/hooks/useEmail';
import { useInboxDisplayPrefs } from '@/hooks/useInboxDisplayPrefs';
import { useMessageActions } from '@/hooks/useMessageActions';
import { useRecentSearches } from '@/hooks/useRecentSearches';
import type { Message, SavedEmailSearchFilters } from '@/services/emailApi';
import { messageRoute } from '@/utils/messageRoute';
import { recordInboxMetric } from '@/utils/inboxTelemetry';
import {
  buildSearchItems,
  collectUnreadable,
  type SearchItem,
} from '@/utils/searchItems';
import {
  collapseThreads,
  formatSearchInterpretation,
  parseSearchQuery,
} from '@/utils/threadGrouping';
import { useOxy } from '@oxy.so/services';

interface SearchListProps {
  replaceNavigation?: boolean;
}

export function SearchList({ replaceNavigation }: SearchListProps) {
  const router = useRouter();
  const colors = useColors();
  const { t } = useTranslation();
  const { density, showPreviews } = useInboxDisplayPrefs();
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
  const {
    recentSearches,
    remember: rememberSearch,
    clear: clearRecentSearches,
  } = useRecentSearches(user?.id);
  const messageActions = useMessageActions();
  const { data: mailboxes = [] } = useMailboxes();

  const [query, setQuery] = useSearchSessionState('query');
  const [submittedQuery, setSubmittedQuery] =
    useSearchSessionState('submittedQuery');
  const [filters, setFilters] = useSearchSessionState('filters');
  const [nlInterpretation, setNlInterpretation] =
    useSearchSessionState('nlInterpretation');
  const [nlParsedOptions, setNlParsedOptions] =
    useSearchSessionState('nlParsedOptions');
  const searchRunIdRef = useRef(0);

  // Natural language search hook
  const { parseQuery: parseNL, isLoading: nlParsing } =
    useNaturalLanguageSearch();

  // Parse the submitted query for Gmail-style operators
  const parsedQuery = useMemo(
    () => parseSearchQuery(submittedQuery),
    [submittedQuery],
  );
  const requestedMailbox =
    nlParsedOptions?.mailbox ?? parsedQuery.mailbox ?? filters.mailbox;

  // Map mailbox name to mailbox ID
  const mailboxIdFromName = useMemo(() => {
    if (!requestedMailbox) return undefined;
    // Saved searches persist the resolved mailbox id. Keep accepting the
    // human-readable special-use names used by the parser as well.
    const existingMailbox = mailboxes.find(
      (mailbox) => mailbox._id === requestedMailbox,
    );
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
    const mailbox = mailboxes.find(
      (m) => m.name.toLowerCase() === requestedMailbox,
    );
    return mailbox?._id;
  }, [requestedMailbox, mailboxes]);

  const mailboxUnresolved = !!requestedMailbox && !mailboxIdFromName;

  // `label:work` names the label "Work": labels are matched as the user wrote
  // them, but the API compares exactly, so the operator is resolved to the
  // label's own name. One that names no label is passed on unchanged.
  const { data: labels = [] } = useLabels();
  const requestedLabel = parsedQuery.label ?? filters.label;
  const resolvedLabel = useMemo(() => {
    if (!requestedLabel) return undefined;
    const target = requestedLabel.toLowerCase();
    return labels.find((l) => l.name.toLowerCase() === target)?.name ?? requestedLabel;
  }, [requestedLabel, labels]);

  const searchOptions = useMemo(
    () => ({
      // NL parsed options take precedence, then Gmail-style operators, then filter chips.
      q: nlParsedOptions?.q ?? (parsedQuery.text || undefined),
      from: nlParsedOptions?.from ?? parsedQuery.from ?? filters.from,
      to: nlParsedOptions?.to ?? parsedQuery.to ?? filters.to,
      subject:
        nlParsedOptions?.subject ?? parsedQuery.subject ?? filters.subject,
      hasAttachment:
        nlParsedOptions?.hasAttachment ??
        parsedQuery.hasAttachment ??
        filters.hasAttachment,
      dateAfter: searchDateBound(
        nlParsedOptions?.after ?? parsedQuery.after ?? filters.dateAfter,
      ),
      dateBefore: searchDateBound(
        nlParsedOptions?.before ?? parsedQuery.before ?? filters.dateBefore,
      ),
      mailbox: mailboxIdFromName,
      starred:
        nlParsedOptions?.starred ?? parsedQuery.starred ?? filters.starred,
      unread: nlParsedOptions?.unread ?? parsedQuery.unread ?? filters.unread,
      // Labels are parsed from Gmail-style operators. The natural-language
      // result type intentionally has no label field.
      label: resolvedLabel,
    }),
    [nlParsedOptions, parsedQuery, filters, mailboxIdFromName, resolvedLabel],
  );

  const {
    data: searchData,
    isLoading: searching,
    isError: searchFailed,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useSearchMessages(searchOptions, {
    // `in:<folder>` that names no folder is not "every folder": the search
    // used to run across all mail as if the operator were not there.
    enabled: !mailboxUnresolved,
  });
  const messages = useMemo(() => {
    if (mailboxUnresolved) return [];
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
  }, [searchData, mailboxUnresolved]);
  // Search pages are grouped only after they are merged. This avoids one row
  // per page and lets a related message loaded later update the same row.
  // The API still needs a server-side threadId for authoritative cross-page
  // grouping when a result set is incomplete.
  const results = useMemo(() => collapseThreads(messages), [messages]);
  const unreadable = useMemo(
    () => collectUnreadable(searchData?.pages ?? []),
    [searchData],
  );
  const items = useMemo(
    () => buildSearchItems(results, unreadable),
    [results, unreadable],
  );
  const total = searchData?.pages[0]?.pagination.total ?? 0;
  const hasSearched = hasSearchCriteria(searchOptions);

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
    async (
      rawText: string,
      { allowAI }: { allowAI: boolean } = { allowAI: true },
    ) => {
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
        setNlInterpretation(
          t('search.nl.searching', {
            filters: formatSearchInterpretation(quickResult, t),
          }),
        );
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
            result.interpretation ||
              t('search.nl.searching', {
                filters: formatSearchInterpretation(parsed, t),
              }),
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
    [parseNL, t, setSubmittedQuery, setNlInterpretation, setNlParsedOptions],
  );

  // Debounced search-as-you-type. The user pressing Enter submits immediately.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      // A list can move between the route and shell slots on resize. An old
      // debounce/AI response must not overwrite a newer search in its successor.
      searchRunIdRef.current += 1;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const handleQueryChange = useCallback(
    (text: string) => {
      searchRunIdRef.current += 1;
      setQuery(text);
      setNlParsedOptions(null);
      setNlInterpretation('');
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
    [
      runSearch,
      setQuery,
      setSubmittedQuery,
      setNlInterpretation,
      setNlParsedOptions,
    ],
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
      hasOperators: /\b(?:from|to|subject|in|is|has|label|after|before):/i.test(
        trimmed,
      ),
    });
    runSearch(query, { allowAI: true });
  }, [rememberSearch, runSearch, query]);

  const openConversation = useCallback(
    (messageId: string) => {
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
    [router, replaceNavigation],
  );

  const handleMessagePress = useCallback(
    (message: Message) => {
      if (message.flags.draft) {
        router.push(messageRoute(message));
        return;
      }
      messageActions.prepareOpenMessage(message._id);
      openConversation(message._id);
    },
    [router, messageActions, openConversation],
  );

  const handleBack = useGoBack();

  const cancelPendingSearch = useCallback(() => {
    searchRunIdRef.current += 1;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  const handleClear = useCallback(() => {
    cancelPendingSearch();
    setQuery('');
    setSubmittedQuery('');
    setFilters({});
    setNlInterpretation('');
    setNlParsedOptions(null);
    inputRef.current?.focus();
  }, [
    cancelPendingSearch,
    setQuery,
    setSubmittedQuery,
    setFilters,
    setNlInterpretation,
    setNlParsedOptions,
  ]);

  // Transfer parsed operators to explicit chips when a filter is edited. This
  // makes removing a chip remove the real filter, including one from AI/text.
  const handleFiltersChange = useCallback(
    (next: SearchFilters) => {
      cancelPendingSearch();
      // A quick chip can be clicked before the typing debounce has run. Keep
      // those new words instead of replacing them with the previous request.
      if (!nlParsedOptions && query.trim() !== submittedQuery.trim()) {
        setFilters(next);
        void runSearch(query, { allowAI: false });
        return;
      }
      const text = searchOptions.q ?? '';
      setQuery(text);
      setSubmittedQuery('');
      setFilters(next);
      setNlParsedOptions(text ? { q: text } : null);
      setNlInterpretation('');
    },
    [
      cancelPendingSearch,
      nlParsedOptions,
      query,
      submittedQuery,
      runSearch,
      searchOptions.q,
      setQuery,
      setSubmittedQuery,
      setFilters,
      setNlParsedOptions,
      setNlInterpretation,
    ],
  );

  const handleApplySavedSearch = useCallback(
    (saved: { query: string; filters: SavedEmailSearchFilters }) => {
      cancelPendingSearch();
      setQuery(saved.query);
      setFilters(pickSearchFilters(saved.filters));
      // Persisted filters are the executed search, including read=false and
      // labels. Preserve legacy query-only saved searches as operator input.
      const hasFilters =
        hasSearchCriteria(saved.filters) || saved.filters.q !== undefined;
      setSubmittedQuery(hasFilters ? '' : saved.query);
      setNlParsedOptions(hasFilters ? { q: saved.filters.q ?? '' } : null);
      setNlInterpretation('');
    },
    [
      cancelPendingSearch,
      setQuery,
      setFilters,
      setSubmittedQuery,
      setNlParsedOptions,
      setNlInterpretation,
    ],
  );

  const listExtraData = useMemo(
    () => ({
      selectedMessageId,
      density,
      showPreviews,
      themeKey: `${colors.unread}|${colors.surface}|${colors.secondaryText}|${colors.primary}|${colors.border}`,
    }),
    [
      selectedMessageId,
      density,
      showPreviews,
      colors.unread,
      colors.surface,
      colors.secondaryText,
      colors.primary,
      colors.border,
    ],
  );

  const renderItem = useCallback(
    ({ item }: { item: SearchItem }) =>
      item.kind === 'unreadable' ? (
        <View style={styles.unreadableItem}>
          <UnreadableMessageRow
            message={item.row}
            onOpen={openConversation}
          />
        </View>
      ) : (
        <MessageRow
          message={item.message}
          onSelect={handleMessagePress}
          isSelected={item.message._id === selectedMessageId}
          density={density}
          showPreviews={showPreviews}
        />
      ),
    [handleMessagePress, openConversation, selectedMessageId, density, showPreviews],
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
        <Loading
          size="lg"
          accessibilityLabel={t('common.loading')}
          style={styles.loadingContainer}
        />
      );
    }
    if (!hasSearched) {
      return (
        <EmptyState
          illustration={<EmptyStateSticker name="searchIdle" />}
          title={t('search.empty.idle')}
          description={t('empty.searchDescription')}
          footer={
            recentSearches.length > 0 ? (
              <View style={styles.recentSearches}>
                <Text variant="caption-1-medium">
                  {t('search.ui.recentSearches')}
                </Text>
                {recentSearches.map((recent) => (
                  <Button
                    key={recent}
                    appearance="outline"
                    onPress={() => {
                      cancelPendingSearch();
                      setQuery(recent);
                      void runSearch(recent, { allowAI: false });
                    }}
                  >
                    {recent}
                  </Button>
                ))}
                <Button appearance="plain" onPress={clearRecentSearches}>
                  {t('search.clear')}
                </Button>
              </View>
            ) : undefined
          }
        />
      );
    }
    if (searchFailed) {
      return (
        <EmptyState
          illustration={<EmptyStateSticker name="loadError" />}
          title={t('common.error')}
          description={t('empty.searchErrorDescription')}
          action={{ label: t('common.retry'), onPress: handleRetry }}
        />
      );
    }
    return (
      <EmptyState
        illustration={<EmptyStateSticker name="searchNoResults" />}
        title={t('search.empty.noResults')}
        description={t('empty.noResultsDescription')}
        action={{ label: t('search.clear'), onPress: handleClear }}
      />
    );
  }, [
    clearRecentSearches,
    cancelPendingSearch,
    handleRetry,
    handleClear,
    hasSearched,
    recentSearches,
    runSearch,
    searchFailed,
    searching,
    t,
    setQuery,
  ]);

  const renderFooter = useCallback(() => {
    if (isFetchingNextPage) {
      return (
        <Loading
          size="sm"
          accessibilityLabel={t('common.loading')}
          style={styles.footerLoading}
        />
      );
    }
    if (searchFailed && items.length > 0) {
      return (
        <EmptyState
          variant="compact"
          illustration={<EmptyStateSticker name="loadError" size={64} />}
          title={t('common.error')}
          description={t('empty.searchErrorDescription')}
          action={{ label: t('common.retry'), onPress: handleRetry }}
        />
      );
    }
    return null;
  }, [handleRetry, isFetchingNextPage, items.length, searchFailed, t]);

  const listRef = useRef<FlatList<SearchItem>>(null);
  const occupiedBottom = useBottomEdgeInset();
  const { width: viewportWidth } = useWindowDimensions();
  const bottomClearance = viewportWidth < BREAKPOINTS.md ? occupiedBottom : 0;
  const onListScroll = useMailboxScrollRestoration(
    listRef,
    JSON.stringify([
      'search',
      user?.id,
      submittedQuery,
      filters,
      nlParsedOptions,
    ]),
    !searching && items.length > 0,
  );

  return (
    <View style={styles.container}>
      {/* Keep the search field visible while filters and results scroll. */}
      <View>
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
      </View>

      <Animated.FlatList
        ref={listRef}
        ListHeaderComponent={
          <View>
            {/* Filters scroll so short mobile screens always have room for results. */}
            <SearchFiltersBar
              filters={pickSearchFilters(searchOptions)}
              mailboxes={mailboxes}
              onChange={handleFiltersChange}
            />

            <SavedSearchBar
              query={query}
              filters={searchOptions}
              enabled={
                hasSearched &&
                !searching &&
                !nlParsing &&
                (query.trim() === submittedQuery.trim() ||
                  Boolean(nlParsedOptions))
              }
              onApply={handleApplySavedSearch}
            />

            {/* Explain AI interpretation after explicit submit; filters are already chips. */}
            {(nlInterpretation || nlParsing) && (
              <View className="px-4 pb-3">
                <View className="flex-row items-center gap-2">
                  {nlParsing ? (
                    <Loading
                      variant="inline"
                      size="sm"
                      text={t('search.nl.understanding')}
                      accessibilityLabel={t('search.nl.understanding')}
                      style={styles.nlParsingRow}
                    />
                  ) : (
                    <Text variant="body-2-regular" style={styles.nlText}>
                      {nlInterpretation}
                    </Text>
                  )}
                  {nlInterpretation && !nlParsing && (
                    <IconButton
                      icon={<RiCloseLine />}
                      accessibilityLabel={t('common.close')}
                      onPress={() => {
                        setNlInterpretation('');
                        setNlParsedOptions(null);
                        setSubmittedQuery(query.trim());
                      }}
                    />
                  )}
                </View>
              </View>
            )}

            {/* Result count */}
            {hasSearched && !searching && items.length > 0 && (
              <View style={styles.resultCount}>
                <Text
                  variant="caption-1-medium"
                  style={{ color: colors.secondaryText }}
                >
                  {t('search.results', { count: total })}
                </Text>
              </View>
            )}
          </View>
        }
        data={searching ? [] : items}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
        extraData={listExtraData}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        onScroll={onListScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          ...(items.length === 0 ? styles.emptyListContent : null),
          ...styles.listContent,
          paddingTop: 0,
          paddingBottom: bottomClearance,
        }}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <Divider spacing={0} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  unreadableItem: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  listContent: {
    width: '100%',
    alignSelf: 'center',
  },
  resultCount: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  loadingContainer: {
    flex: 1,
    paddingTop: 40,
    alignItems: 'center',
  },
  recentSearches: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'stretch',
    gap: 8,
    paddingHorizontal: 24,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  footerLoading: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  nlText: {
    flex: 1,
  },
  nlParsingRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
