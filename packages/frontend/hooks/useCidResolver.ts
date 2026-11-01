/** Resolve inline images without publishing a previous observed session's URLs. */
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { OxyServices } from '@oxy.so/core';
import { ATTACHMENT_URL_STALE_MS } from '@/hooks/queries/useAttachmentUrl';
import { reserveInferenceNamespace } from '@/hooks/queries/inferenceNamespace';
import { useObservedInferenceOwner } from '@/hooks/queries/useObservedInferenceOwner';
import { emailKeys } from '@/hooks/queries/queryKeys';
import type { Message } from '@/services/emailApi';
import { normalizeContentId, resolveCidImages } from '@/utils/htmlTransform';

type CidMaps = Record<string, Record<string, string>>;
const NO_MAPS: CidMaps = {};
const serviceScopes = new WeakMap<QueryClient, WeakMap<OxyServices, WeakMap<object, string>>>();
type Lease = { id: string; observers: number };
const activeScopes = new WeakMap<QueryClient, Map<string, Lease>>();

/** Keep the confirmed cache local to a client, service and runtime, without retaining them. */
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

/** A retired lease cannot publish a request after the last observer leaves. */
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

export function useCidResolver(
  messages: Message[],
  oxyServices: OxyServices | null | undefined,
  resetKey: string,
): Record<string, string> {
  const queryClient = useQueryClient();
  const owner = useObservedInferenceOwner();
  const scope = useMemo(
    () => ({
      service: oxyServices,
      identity: [
        oxyServices ? serviceScope(queryClient, oxyServices, owner.runtime) : null,
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
      oxyServices,
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
  const shownKey = useRef(resetKey);
  useLayoutEffect(() => {
    const { lease, release } = acquireScope(queryClient, scopeKey);
    committed.current = { scope, lease };
    return () => {
      if (committed.current?.scope === scope) committed.current = null;
      release();
    };
  }, [scope, scopeKey, queryClient]);
  useLayoutEffect(() => {
    shownKey.current = resetKey;
  }, [resetKey]);
  const [store, setStore] = useState<{ scope: typeof scope; key: string; maps: CidMaps }>(() => ({
    scope,
    key: resetKey,
    maps: NO_MAPS,
  }));
  const cidMaps =
    owner.ready &&
    oxyServices &&
    oxyServices.http === owner.http &&
    store.scope === scope &&
    store.key === resetKey
      ? store.maps
      : NO_MAPS;
  const inFlight = useRef({ scope, key: resetKey, ids: new Set<string>() });

  useEffect(() => {
    if (!oxyServices || !owner.ready || oxyServices.http !== owner.http) return;
    const key = resetKey;
    const lease = committed.current?.scope === scope ? committed.current.lease : null;
    const ownerCurrent = () => !!lease && lease.observers > 0 && owner.isCurrent();
    const current = () =>
      committed.current?.scope === scope && shownKey.current === key && ownerCurrent();
    if (!current()) return;
    if (inFlight.current.scope !== scope || inFlight.current.key !== key)
      inFlight.current = { scope, key, ids: new Set() };
    const ids = inFlight.current.ids;
    const pending = messages.filter(
      (msg) =>
        !(msg._id in cidMaps) && !ids.has(msg._id) && msg.attachments.some((a) => a.contentId),
    );
    if (pending.length === 0) return;
    for (const msg of pending) ids.add(msg._id);

    (async () => {
      const newEntries: [string, Record<string, string>][] = [];
      for (const msg of pending) {
        if (!current()) break;
        const cidMap: Record<string, string> = {};
        await Promise.all(
          msg.attachments.map(async (att) => {
            if (!att.contentId || !current()) return;
            try {
              // The old unscoped cache has no reliable owner. Keep completed
              // URLs separate from each lease's in-flight request instead.
              const cacheKey = [
                ...emailKeys.attachmentUrl(att.fileId),
                'cid-scoped-v1',
                ...scope.identity,
              ];
              const cached = queryClient.getQueryState<string>(cacheKey);
              let url =
                cached?.status === 'success' &&
                !cached.isInvalidated &&
                Date.now() - cached.dataUpdatedAt < ATTACHMENT_URL_STALE_MS
                  ? cached.data
                  : undefined;
              if (!url) {
                url = await queryClient.fetchQuery({
                  queryKey: [...cacheKey, 'pending', lease?.id],
                  queryFn: async () => {
                    if (!ownerCurrent()) throw new Error('Email account changed');
                    const resolved = await oxyServices.assets.url(att.fileId);
                    if (!ownerCurrent()) throw new Error('Email account changed');
                    return resolved;
                  },
                  staleTime: 0,
                });
                if (!ownerCurrent()) return;
                queryClient.setQueryData(cacheKey, url);
              }
              if (url && current()) cidMap[normalizeContentId(att.contentId)] = url;
            } catch {
              /* The image stays a cid: reference. */
            }
          }),
        );
        if (current()) newEntries.push([msg._id, cidMap]);
      }
      for (const msg of pending) ids.delete(msg._id);
      if (!current()) return;
      setStore((prev) => {
        if (!current()) return prev;
        const next = { ...(prev.scope === scope && prev.key === key ? prev.maps : NO_MAPS) };
        for (const [id, map] of newEntries) next[id] = map;
        return { scope, key, maps: next };
      });
    })();
  }, [messages, oxyServices, cidMaps, resetKey, queryClient, owner, scope]);

  return useMemo(() => {
    const map: Record<string, string> = {};
    for (const msg of messages) {
      if (!msg.html) continue;
      const cidMap = cidMaps[msg._id];
      map[msg._id] = cidMap ? resolveCidImages(msg.html, cidMap) : msg.html;
    }
    return map;
  }, [messages, cidMaps]);
}
