/** Shared, memory-only scope for inline and thumbnail attachment URLs. */
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useLayoutEffect, useMemo, useRef } from 'react';
import type { OxyServices } from '@oxy.so/core';
import { reserveInferenceNamespace } from '@/hooks/queries/inferenceNamespace';
import { useObservedInferenceOwner } from '@/hooks/queries/useObservedInferenceOwner';
import { emailKeys } from '@/hooks/queries/queryKeys';

export const ATTACHMENT_URL_STALE_MS = 45 * 60 * 1000;
type Lease = { id: string; observers: number };
const serviceScopes = new WeakMap<QueryClient, WeakMap<OxyServices, WeakMap<object, string>>>();
const activeScopes = new WeakMap<QueryClient, Map<string, Lease>>();

/** Scope confirmed URLs without retaining clients, services or runtimes. */
function serviceScope(client: QueryClient, service: OxyServices, runtime: object) {
  let services = serviceScopes.get(client);
  if (!services) {
    services = new WeakMap();
    serviceScopes.set(client, services);
  }
  let runtimes = services.get(service);
  if (!runtimes) {
    runtimes = new WeakMap();
    services.set(service, runtimes);
  }
  let namespace = runtimes.get(runtime);
  if (!namespace) {
    namespace = reserveInferenceNamespace(client);
    runtimes.set(runtime, namespace);
  }
  return namespace;
}
/** A request from a retired lease cannot be accepted by a later remount. */
function acquireScope(client: QueryClient, key: string) {
  let entries = activeScopes.get(client);
  if (!entries) {
    entries = new Map();
    activeScopes.set(client, entries);
  }
  let lease = entries.get(key);
  if (!lease) {
    lease = { id: reserveInferenceNamespace(client), observers: 0 };
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
export function useScopedAttachmentContext(service: OxyServices | null | undefined, active = true) {
  const queryClient = useQueryClient();
  const owner = useObservedInferenceOwner();
  const scope = useMemo(
    () => ({
      service,
      identity: [
        service ? serviceScope(queryClient, service, owner.runtime) : null,
        owner.subject,
        owner.sessionId,
        owner.revision,
        owner.epoch,
        owner.knownSubject,
        owner.authenticated,
      ],
    }),
    [
      queryClient,
      service,
      owner.runtime,
      owner.subject,
      owner.sessionId,
      owner.revision,
      owner.epoch,
      owner.knownSubject,
      owner.authenticated,
    ],
  );
  const scopeKey = JSON.stringify(scope.identity);
  const committed = useRef<{ scope: typeof scope; lease: Lease } | null>(null);
  useLayoutEffect(() => {
    if (!active) return;
    const { lease, release } = acquireScope(queryClient, scopeKey);
    committed.current = { scope, lease };
    return () => {
      if (committed.current?.scope === scope) committed.current = null;
      release();
    };
  }, [scope, scopeKey, queryClient, active]);
  return { queryClient, owner, scope, committed };
}

export function scopedAttachmentKey(
  fileId: string,
  variant: string | undefined,
  identity: unknown[],
) {
  return [...emailKeys.attachmentUrl(fileId, variant), 'cid-scoped-v1', ...identity] as const;
}

export async function resolveScopedAttachment({
  queryClient,
  service,
  identity,
  lease,
  fileId,
  variant,
  ownerCurrent,
  publish,
}: {
  queryClient: QueryClient;
  service: OxyServices;
  identity: unknown[];
  lease: Lease;
  fileId: string;
  variant?: string;
  ownerCurrent: () => boolean;
  publish: boolean;
}): Promise<string> {
  const cacheKey = scopedAttachmentKey(fileId, variant, identity);
  // A query observer calls this when it has already decided to fetch; a CID
  // caller can reuse a fresh confirmed value without extending its lifetime.
  const cached = publish ? queryClient.getQueryState<string>(cacheKey) : undefined;
  let url =
    cached?.status === 'success' &&
    !cached.isInvalidated &&
    Date.now() - cached.dataUpdatedAt < ATTACHMENT_URL_STALE_MS
      ? cached.data
      : undefined;
  if (!url) {
    // An active lease shares in-flight work but a later lease gets a new key.
    url = await queryClient.fetchQuery({
      queryKey: [...cacheKey, 'pending', lease.id],
      queryFn: async () => {
        if (!ownerCurrent()) throw new Error('Email account changed');
        const resolved = await service.assets.url(fileId, variant);
        if (!ownerCurrent()) throw new Error('Email account changed');
        return resolved;
      },
      staleTime: 0,
    });
    if (!ownerCurrent()) throw new Error('Email account changed');
    if (publish) queryClient.setQueryData(cacheKey, url);
  }
  if (!url) throw new Error('Attachment URL unavailable');
  return url;
}
