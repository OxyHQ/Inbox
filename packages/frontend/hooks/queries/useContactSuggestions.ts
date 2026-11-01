import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isEmailApiOwnedBy, useEmailStore } from '@/hooks/useEmail';
import { emailKeys } from '@/hooks/queries/queryKeys';
import { reserveInferenceNamespace } from '@/hooks/queries/inferenceNamespace';
import { runObservedInference } from '@/hooks/queries/runObservedInference';
import { useObservedInferenceOwner } from '@/hooks/queries/useObservedInferenceOwner';
import type { ContactSuggestion } from '@/services/emailApi';

export function useContactSuggestions(query: string) {
  const api = useEmailStore((s) => s._api);
  const owner = useObservedInferenceOwner();
  const client = useQueryClient();
  const apiScope = useMemo(
    () => ({ api, mount: reserveInferenceNamespace(client) }),
    [client, api],
  );
  const trimmed = query.trim();
  const scope = [
    apiScope.mount,
    owner.binding,
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
