/**
 * Natural Language Search hook.
 *
 * Parses natural language queries into structured search options using AI.
 * Examples:
 * - "emails from Sarah last week" → { from: "sarah", after: "2025-01-29" }
 * - "unread emails about budget" → { q: "budget", unread: true }
 * - "attachments from John" → { from: "john", hasAttachment: true }
 */

import { useMutation } from '@tanstack/react-query';
import { useOxy } from '@oxy.so/services';
import { runInboxNaturalSearch } from '@/services/inboxInferenceApi';
import { aiKeys } from '@/hooks/queries/queryKeys';

export interface ParsedSearchQuery {
  q?: string;
  from?: string;
  to?: string;
  subject?: string;
  hasAttachment?: boolean;
  starred?: boolean;
  unread?: boolean;
  after?: string;
  before?: string;
  mailbox?: string;
}

export interface NaturalLanguageSearchResult {
  query: ParsedSearchQuery;
  interpretation: string;
}

export function useNaturalLanguageSearch() {
  const { oxyServices } = useOxy();

  const mutation = useMutation<NaturalLanguageSearchResult, Error, string>({
    mutationKey: aiKeys.naturalLanguageSearch,
    mutationFn: async (naturalLanguage: string) => {
      if (!naturalLanguage.trim()) {
        return { query: {}, interpretation: '' };
      }

      // Quick check: if it looks like a standard Gmail-style operator, skip AI parsing
      const hasOperators = /(from:|to:|subject:|in:|is:|has:|label:)/i.test(naturalLanguage);
      if (hasOperators) {
        // Let the existing operator parser handle it downstream.
        return { query: { q: naturalLanguage }, interpretation: 'Using search operators' };
      }

      try {
        return await runInboxNaturalSearch(oxyServices.httpService, naturalLanguage);
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') throw error;
        return {
          query: { q: naturalLanguage },
          interpretation: `Searching for "${naturalLanguage}"`,
        };
      }
    },
  });

  const { mutateAsync } = mutation;

  return {
    parseQuery: mutateAsync,
    lastResult: mutation.data ?? null,
    isLoading: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Simple client-side parsing for common patterns (no AI needed)
 */
export function quickParseSearch(query: string): ParsedSearchQuery | null {
  const q = query.toLowerCase().trim();

  // "unread" or "unread emails"
  if (/^unread( emails?)?$/.test(q)) {
    return { unread: true };
  }

  // "starred" or "starred emails"
  if (/^starred( emails?)?$/.test(q)) {
    return { starred: true };
  }

  // "with attachments" or "has attachments"
  if (/^(with|has) attachments?$/.test(q)) {
    return { hasAttachment: true };
  }

  // "from X" pattern
  const fromMatch = q.match(/^from\s+(\S+)/);
  if (fromMatch) {
    return { from: fromMatch[1] };
  }

  // "to X" pattern
  const toMatch = q.match(/^to\s+(\S+)/);
  if (toMatch) {
    return { to: toMatch[1] };
  }

  return null;
}
