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
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useOxy } from '@oxy.so/services/ui/client';
import { runObservedInference } from '@/hooks/queries/runObservedInference';
import { useObservedInferenceOwner } from '@/hooks/queries/useObservedInferenceOwner';
import { runInboxNaturalSearch } from '@/services/inboxInferenceApi';
import { aiKeys } from '@/hooks/queries/queryKeys';
import { useTranslation } from '@/lib/i18n';

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

function obsoleteSearch(): Error {
  const error = new Error('Search session changed.');
  error.name = 'AbortError';
  return error;
}

type SearchVariables = { text: string };
type SearchOwner = {
  binding: object;
  owner: ReturnType<typeof useObservedInferenceOwner>;
  controller: AbortController;
};
const searchOwners = new WeakMap<SearchVariables, SearchOwner>();

export function useNaturalLanguageSearch() {
  const { t } = useTranslation();
  const { oxyServices } = useOxy();
  const owner = useObservedInferenceOwner();
  const binding = useMemo(
    () => ({
      identity: [
        owner.binding,
        owner.subject,
        owner.sessionId,
        owner.revision,
        owner.epoch,
        owner.knownSubject,
        owner.authenticated,
      ],
      controllers: new Set<AbortController>(),
    }),
    [
      owner.binding,
      owner.subject,
      owner.sessionId,
      owner.revision,
      owner.epoch,
      owner.knownSubject,
      owner.authenticated,
    ],
  );
  const committed = useRef<typeof binding | null>(null);
  useLayoutEffect(() => {
    committed.current = binding;
    return () => {
      if (committed.current === binding) committed.current = null;
      for (const controller of binding.controllers) controller.abort();
      binding.controllers.clear();
    };
  }, [binding]);
  const current = (record: SearchOwner) =>
    committed.current === record.binding &&
    record.owner.ready &&
    record.owner.isCurrent() &&
    !record.controller.signal.aborted;
  const isCurrent = () => committed.current === binding && owner.ready && owner.isCurrent();
  const isBindingCurrent = () => {
    const projection = owner.runtime.getAccountSessionIdentity();
    return (
      committed.current === binding &&
      projection.revision === owner.revision &&
      projection.sessionId === owner.sessionId &&
      owner.http.getSessionEpoch() === owner.epoch &&
      oxyServices.session.userId === owner.knownSubject &&
      oxyServices.session.isAuthenticated === owner.authenticated
    );
  };

  const mutation = useMutation<NaturalLanguageSearchResult, Error, SearchVariables>({
    mutationKey: aiKeys.naturalLanguageSearch,
    mutationFn: async (variables) => {
      const record = searchOwners.get(variables);
      if (!record || !current(record)) throw obsoleteSearch();
      const naturalLanguage = variables.text;
      if (!naturalLanguage.trim()) return { query: {}, interpretation: '' };
      const hasOperators = /(from:|to:|subject:|in:|is:|has:|label:)/i.test(naturalLanguage);
      if (hasOperators)
        return { query: { q: naturalLanguage }, interpretation: t('search.nl.usingOperators') };
      try {
        return await runObservedInference(record.owner, record.controller.signal, (signal) =>
          runInboxNaturalSearch(record.owner.http, naturalLanguage, signal),
        );
      } catch (error: unknown) {
        if (!current(record) || (error instanceof Error && error.name === 'AbortError'))
          throw obsoleteSearch();
        return {
          query: { q: naturalLanguage },
          interpretation: t('search.nl.searchingFor', { value: naturalLanguage }),
        };
      }
    },
  });
  const visible = mutation.variables
    ? searchOwners.get(mutation.variables)?.binding === binding
    : true;
  const parseQuery = async (text: string) => {
    const controller = new AbortController();
    const record = { binding, owner, controller };
    if (!current(record)) throw obsoleteSearch();
    const variables = { text };
    searchOwners.set(variables, record);
    binding.controllers.add(controller);
    try {
      const result = await mutation.mutateAsync(variables);
      if (!current(record)) throw obsoleteSearch();
      return result;
    } finally {
      binding.controllers.delete(controller);
    }
  };
  return {
    parseQuery,
    isCurrent,
    isBindingCurrent,
    binding,
    isReady: owner.ready,
    lastResult: visible ? (mutation.data ?? null) : null,
    isLoading: visible && mutation.isPending,
    error: visible ? mutation.error : null,
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
