import { useLayoutEffect, useMemo, useRef } from 'react';
import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { isEmailApiOwnedBy, useEmailStore } from '@/hooks/useEmail';
import { emailKeys } from '@/hooks/queries/queryKeys';
import { reserveInferenceNamespace } from '@/hooks/queries/inferenceNamespace';
import { runObservedInference } from '@/hooks/queries/runObservedInference';
import { useObservedInferenceOwner } from '@/hooks/queries/useObservedInferenceOwner';
import type { ContactSuggestion, EmailApiInstance } from '@/services/emailApi';

const scopes = new WeakMap<QueryClient, WeakMap<EmailApiInstance, WeakMap<object, string>>>();
type ScopeLease = { observers: number };
const activeScopes = new WeakMap<QueryClient, Map<string, ScopeLease>>();

/** Join a committed scope; a retired lease is never revived after its final observer leaves. */
function acquireScope(client: QueryClient, key: string) {
  let entries = activeScopes.get(client);
  if (!entries) {
    entries = new Map();
    activeScopes.set(client, entries);
  }
  let lease = entries.get(key);
  if (!lease) {
    lease = { observers: 0 };
    entries.set(key, lease);
  }
  lease.observers++;
  const current = lease;
  let released = false;
  return {
    lease: current,
    release: () => {
      if (released) return;
      released = true;
      current.observers--;
      if (current.observers === 0 && entries?.get(key) === current) entries.delete(key);
    },
  };
}

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
  const binding = useMemo(
    () => ({
      identity: [
        owner.binding,
        apiScope,
        owner.subject,
        owner.sessionId,
        owner.revision,
        owner.epoch,
        owner.knownSubject,
        owner.authenticated,
      ],
    }),
    [
      owner.binding,
      apiScope,
      owner.subject,
      owner.sessionId,
      owner.revision,
      owner.epoch,
      owner.knownSubject,
      owner.authenticated,
    ],
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
  const scopeKey = JSON.stringify(scope);
  const committed = useRef<{ binding: typeof binding; lease: ScopeLease } | null>(null);
  useLayoutEffect(() => {
    const { lease, release } = acquireScope(client, scopeKey);
    committed.current = { binding, lease };
    return () => {
      if (committed.current?.binding === binding) committed.current = null;
      release();
    };
  }, [client, binding, scopeKey]);
  const eligible = () =>
    !!api &&
    useEmailStore.getState()._api === api &&
    isEmailApiOwnedBy(api, owner.http) &&
    owner.ready &&
    owner.isCurrent();
  const canSelect = () => committed.current?.binding === binding && eligible();
  const result = useQuery<ContactSuggestion[]>({
    queryKey: [...emailKeys.contactSuggestions(trimmed), ...scope],
    queryFn: async ({ signal }) => {
      const lease = committed.current?.binding === binding ? committed.current.lease : null;
      const canFetch = () => !!lease && lease.observers > 0 && eligible();
      if (!api || !canFetch()) throw new Error('Email account changed');
      return runObservedInference(owner, signal, async (requestSignal) => {
        const suggestions = await api.suggestContacts(trimmed, requestSignal);
        if (!canFetch()) throw new Error('Email account changed');
        return suggestions;
      });
    },
    enabled: eligible() && trimmed.length >= 2,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    placeholderData: (prev, previousQuery) =>
      previousQuery?.queryKey.length === scope.length + 2 &&
      scope.every((value, index) => previousQuery.queryKey[index + 2] === value)
        ? prev
        : undefined,
  });
  return { ...result, data: eligible() ? result.data : undefined, canSelect };
}
