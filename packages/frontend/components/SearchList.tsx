import { useMailboxScrollRestoration } from '@/hooks/useMailboxScrollRestoration';
/**
 * Search emails list with Gmail-style search bar and filter chips.
 */

import { useSearchFocus } from '@/contexts/search-focus-context';
import { useSearchSessionState } from '@/contexts/search-session-context';
import { useGoBack } from '@/hooks/useGoBack';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { useTranslation } from '@/lib/i18n';
import { Button, IconButton } from '@oxy.so/bloom/button';
import { Chip } from '@oxy.so/bloom/chip';
import { EmptyState } from '@oxy.so/bloom/empty-state';
import { RiAttachmentLine, RiCloseLine, RiErrorWarningLine } from '@oxy.so/bloom/icons';
import { Loading } from '@oxy.so/bloom/loading';
import { TextFieldInput } from '@oxy.so/bloom/text-field';
import { Text } from '@oxy.so/bloom/typography';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  type FlatList,
  StyleSheet,
  type TextInput,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyIllustration } from '@/components/EmptyIllustration';
import { MessageRow } from '@/components/MessageRow';
import { SavedSearchBar } from '@/components/SavedSearchBar';
import { SearchHeader } from '@/components/SearchHeader';
import { UnreadableMessageRow } from '@/components/UnreadableMessageRow';
import { CONTENT_MAX_WIDTH, SPACING } from '@/constants/layout';
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
import type { SavedEmailSearchFilters } from '@/services/emailApi';
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
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
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
  const [filterFrom, setFilterFrom] = useSearchSessionState('filterFrom');
  const [filterHasAttachment, setFilterHasAttachment] = useSearchSessionState(
    'filterHasAttachment',
  );
  const [editingFilter, setEditingFilter] =
    useSearchSessionState('editingFilter');
  const [filterInput, setFilterInput] = useSearchSessionState('filterInput');
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
  const requestedMailbox = nlParsedOptions?.mailbox ?? parsedQuery.mailbox;

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

  const searchOptions = useMemo(
    () => ({
      // NL parsed options take precedence, then Gmail-style operators, then filter chips.
      q: nlParsedOptions?.q ?? (parsedQuery.text || undefined),
      from:
        nlParsedOptions?.from ?? parsedQuery.from ?? (filterFrom || undefined),
      to: nlParsedOptions?.to ?? parsedQuery.to,
      subject: nlParsedOptions?.subject ?? parsedQuery.subject,
      hasAttachment:
        nlParsedOptions?.hasAttachment ??
        parsedQuery.hasAttachment ??
        (filterHasAttachment || undefined),
      dateAfter: nlParsedOptions?.after ?? parsedQuery.after,
      dateBefore: nlParsedOptions?.before ?? parsedQuery.before,
      mailbox: mailboxIdFromName,
      starred: nlParsedOptions?.starred ?? parsedQuery.starred,
      unread: nlParsedOptions?.unread ?? parsedQuery.unread,
      // Labels are parsed from Gmail-style operators. The natural-language
      // result type intentionally has no label field.
      label: parsedQuery.label,
    }),
    [
      nlParsedOptions,
      parsedQuery,
      filterFrom,
      filterHasAttachment,
      mailboxIdFromName,
    ],
  );

  const {
    data: searchData,
    isLoading: searching,
    isError: searchFailed,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useSearchMessages(searchOptions);
  const messages = useMemo(() => {
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
  }, [searchData]);
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
          hasAttachment:
            parsedQuery.hasAttachment ?? (filterHasAttachment || undefined),
        },
        t,
      ),
    [
      filterFrom,
      filterHasAttachment,
      nlParsedOptions,
      parsedQuery,
      requestedMailbox,
      t,
    ],
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
  }, [
    setQuery,
    setSubmittedQuery,
    setFilterFrom,
    setFilterHasAttachment,
    setNlInterpretation,
    setNlParsedOptions,
  ]);

  const handleFilterChipPress = useCallback(
    (filter: string) => {
      if (filter === 'attachment') {
        setFilterHasAttachment((v) => !v);
      } else {
        setEditingFilter(filter);
        setFilterInput(filter === 'from' ? filterFrom : '');
      }
    },
    [filterFrom, setFilterHasAttachment, setEditingFilter, setFilterInput],
  );

  const handleFilterSubmit = useCallback(() => {
    if (editingFilter === 'from') {
      setFilterFrom(filterInput.trim());
    }
    setEditingFilter(null);
    setFilterInput('');
  }, [
    editingFilter,
    filterInput,
    setFilterFrom,
    setEditingFilter,
    setFilterInput,
  ]);

  const handleApplySavedSearch = useCallback(
    (saved: { query: string; filters: SavedEmailSearchFilters }) => {
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
    },
    [
      setQuery,
      setFilterFrom,
      setFilterHasAttachment,
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
            onOpen={handleMessagePress}
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
    [handleMessagePress, selectedMessageId, density, showPreviews],
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
      return <Loading size="large" accessibilityLabel={t('common.loading')} style={styles.loadingContainer} />;
    }
    if (!hasSearched) {
      return (
        <EmptyState
          illustration={<EmptyIllustration size={180} />}
          description={t('search.empty.idle')}
          footer={recentSearches.length > 0 ? (
            <View style={styles.recentSearches}>
              {recentSearches.map((recent) => (
                <Button
                  key={recent}
                  appearance="outline"
                  onPress={() => {
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
          ) : undefined}
        />
      );
    }
    if (searchFailed) {
      return (
        <EmptyState
          icon={RiErrorWarningLine}
          title={t('common.error')}
          action={{ label: t('common.retry'), onPress: handleRetry }}
        />
      );
    }
    return (
      <EmptyState
        illustration={<EmptyIllustration size={180} />}
        description={t('search.empty.noResults')}
      />
    );
  }, [
    clearRecentSearches,
    handleRetry,
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
      return <Loading size="small" accessibilityLabel={t('common.loading')} style={styles.footerLoading} />;
    }
    if (searchFailed && items.length > 0) {
      return (
        <EmptyState
          variant="compact"
          description={t('common.error')}
          action={{ label: t('common.retry'), onPress: handleRetry }}
        />
      );
    }
    return null;
  }, [handleRetry, isFetchingNextPage, items.length, searchFailed, t]);

  const visibleInterpretation =
    nlInterpretation ||
    (hasSearched && !nlParsing
      ? t('search.nl.searching', { filters: filterInterpretation })
      : '');

  const listRef = useRef<FlatList<SearchItem>>(null);
  const onListScroll = useMailboxScrollRestoration(
    listRef,
    JSON.stringify([
      'search',
      user?.id,
      submittedQuery,
      filterFrom,
      filterHasAttachment,
      nlParsedOptions,
    ]),
    !searching && items.length > 0,
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header and filters stay in flow above the virtualized results. */}
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

        {/* Filter chips */}
        <View
          style={[
            styles.filterBar,
            { paddingLeft: 16 + insets.left, paddingRight: 16 + insets.right },
          ]}
        >
          <Chip
            size="xl"
            selected={Boolean(filterFrom)}
            onPress={() => handleFilterChipPress('from')}
            onClose={filterFrom ? () => setFilterFrom('') : undefined}
            closeLabel={`${t('common.remove')} ${t('search.filters.from')}`}
          >
            {filterFrom
              ? t('search.filters.fromValue', { value: filterFrom })
              : t('search.filters.from')}
          </Chip>
          <Chip
            size="xl"
            role="checkbox"
            checked={filterHasAttachment}
            onCheckedChange={() => handleFilterChipPress('attachment')}
            leadingIcon={RiAttachmentLine}
          >
            {t('search.filters.hasAttachment')}
          </Chip>
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
            {nlParsing ? (
              <Loading
                variant="inline"
                size="small"
                text={t('search.nl.understanding')}
                accessibilityLabel={t('search.nl.understanding')}
                style={styles.nlParsingRow}
              />
            ) : (
              <Text variant="body-2-regular" style={styles.nlText}>
                {visibleInterpretation}
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
        )}

        {/* Filter input overlay */}
        {editingFilter && (
          <View
            style={[
              styles.filterInputRow,
              { backgroundColor: colors.surfaceVariant },
            ]}
          >
            <View className="flex-1">
              <TextFieldInput
                label={editingFilter === 'from' ? t('search.filters.from') : editingFilter}
                value={filterInput}
                onChangeText={setFilterInput}
                autoFocus
                onSubmitEditing={handleFilterSubmit}
                returnKeyType="done"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <IconButton
              icon={<RiCloseLine />}
              accessibilityLabel={t('common.close')}
              onPress={() => setEditingFilter(null)}
            />
          </View>
        )}

        {/* Result count */}
        {hasSearched && !searching && items.length > 0 && (
          <View style={styles.resultCount}>
            <Text variant="caption-1-medium" style={{ color: colors.secondaryText }}>
              {t('search.results', { count: total })}
            </Text>
          </View>
        )}
      </View>

      {searching ? (
        <View style={styles.loadingContainer}>
          <Loading size="large" accessibilityLabel={t('common.loading')} />
        </View>
      ) : (
        <Animated.FlatList
          ref={listRef}
          data={items}
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
            paddingBottom: tabBarClearance,
          }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => (
            <View
              style={[styles.separator, { backgroundColor: colors.border }]}
            />
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
  unreadableItem: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
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
  filterInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
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
