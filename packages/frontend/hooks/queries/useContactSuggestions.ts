import { useMemo } from 'react';
import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { isEmailApiOwnedBy, useEmailStore } from '@/hooks/useEmail';
import { emailKeys } from '@/hooks/queries/queryKeys';
import { reserveInferenceNamespace } from '@/hooks/queries/inferenceNamespace';
import { runObservedInference } from '@/hooks/queries/runObservedInference';
import { useObservedInferenceOwner } from '@/hooks/queries/useObservedInferenceOwner';
import type { ContactSuggestion, EmailApiInstance } from '@/services/emailApi';

const scopes = new WeakMap<QueryClient, WeakMap<EmailApiInstance, WeakMap<object, string>>>();

/** Reuse cache only for the same client, API and runtime while they remain alive. */
function suggestionScope(client: QueryClient, api: EmailApiInstance, runtime: object): string {
  let apis = scopes.get(client);
  if (!apis) {
    apis = new WeakMap();
    scopes.set(client, apis);
  }
  let runtimes = apis.get(api);
  if (!runtimes) {
    runtimes = new WeakMap();
    apis.set(api, runtimes);
  }
  let namespace = runtimes.get(runtime);
  if (!namespace) {
    namespace = reserveInferenceNamespace(client);
    runtimes.set(runtime, namespace);
  }
  return namespace;
}

export function useContactSuggestions(query: string) {
  const api = useEmailStore((s) => s._api);
  const owner = useObservedInferenceOwner();
  const client = useQueryClient();
  const apiScope = useMemo(
    () => (api ? suggestionScope(client, api, owner.runtime) : null),
    [client, api, owner.runtime],
  );
  const trimmed = query.trim();
  const scope = [
    apiScope,
    owner.subject,
    owner.sessionId,
    owner.revision,
    owner.epoch,
    owner.knownSubject,
    owner.authenticated,
  ];
  const canSelect = () =>
    !!api &&
    useEmailStore.getState()._api === api &&
    isEmailApiOwnedBy(api, owner.http) &&
    owner.ready &&
    owner.isCurrent();
  const result = useQuery<ContactSuggestion[]>({
    queryKey: [...emailKeys.contactSuggestions(trimmed), ...scope],
    queryFn: async ({ signal }) => {
      if (!api || !canSelect()) throw new Error('Email account changed');
      return runObservedInference(owner, signal, async (requestSignal) => {
        const suggestions = await api.suggestContacts(trimmed, requestSignal);
        if (!canSelect()) throw new Error('Email account changed');
        return suggestions;
      });
    },
    enabled: canSelect() && trimmed.length >= 2,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    placeholderData: (prev, previousQuery) =>
      previousQuery?.queryKey.length === scope.length + 2 &&
      scope.every((value, index) => previousQuery.queryKey[index + 2] === value)
        ? prev
        : undefined,
  });
  return { ...result, data: canSelect() ? result.data : undefined, canSelect };
}
