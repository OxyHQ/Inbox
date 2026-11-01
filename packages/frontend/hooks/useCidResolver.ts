/** Resolve inline images without publishing a previous observed session's URLs. */
import { onlineManager } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { OxyServices } from '@oxy.so/core';
import {
  resolveScopedAttachment,
  useScopedAttachmentContext,
} from '@/hooks/queries/scopedAttachment';
import type { Message } from '@/services/emailApi';
import { normalizeContentId, resolveCidImages } from '@/utils/htmlTransform';

type CidMaps = Record<string, Record<string, string>>;
type FailureEpochs = Record<string, number>;
const NO_MAPS: CidMaps = {};
const NO_FAILURES: FailureEpochs = {};
export function useCidResolver(
  messages: Message[],
  oxyServices: OxyServices | null | undefined,
  resetKey: string,
): Record<string, string> {
  const { queryClient, owner, scope, committed } = useScopedAttachmentContext(oxyServices);
  const online = useSyncExternalStore(
    onlineManager.subscribe,
    () => onlineManager.isOnline(),
    () => true,
  );
  const wasOnline = useRef(online);
  const [reconnectEpoch, setReconnectEpoch] = useState(0);
  useEffect(() => {
    if (online && !wasOnline.current) setReconnectEpoch((previous) => previous + 1);
    wasOnline.current = online;
  }, [online]);
  const shownKey = useRef(resetKey);
  useLayoutEffect(() => {
    shownKey.current = resetKey;
  }, [resetKey]);
  const [store, setStore] = useState<{
    scope: typeof scope;
    key: string;
    maps: CidMaps;
    failures: FailureEpochs;
  }>(() => ({ scope, key: resetKey, maps: NO_MAPS, failures: NO_FAILURES }));
  const sameStore =
    owner.ready &&
    oxyServices &&
    oxyServices.http === owner.http &&
    store.scope === scope &&
    store.key === resetKey;
  const cidMaps = sameStore ? store.maps : NO_MAPS;
  const failures = sameStore ? store.failures : NO_FAILURES;
  const inFlight = useRef({ scope, key: resetKey, ids: new Set<string>() });

  useEffect(() => {
    if (!oxyServices || !owner.ready || oxyServices.http !== owner.http) return;
    const key = resetKey;
    const lease = committed.current?.scope === scope ? committed.current.lease : null;
    const ownerCurrent = () => !!lease && lease.observers > 0 && owner.isCurrent();
    const current = () =>
      committed.current?.scope === scope && shownKey.current === key && ownerCurrent();
    if (!lease || !current()) return;
    if (inFlight.current.scope !== scope || inFlight.current.key !== key)
      inFlight.current = { scope, key, ids: new Set() };
    const ids = inFlight.current.ids;
    const pending = messages.filter(
      (msg) =>
        (!(msg._id in cidMaps) ||
          (failures[msg._id] !== undefined && failures[msg._id] < reconnectEpoch)) &&
        !ids.has(msg._id) &&
        msg.attachments.some((a) => a.contentId),
    );
    if (pending.length === 0) return;
    for (const msg of pending) ids.add(msg._id);

    (async () => {
      const newEntries: [string, Record<string, string>, boolean][] = [];
      for (const msg of pending) {
        if (!current()) break;
        const cidMap: Record<string, string> = {};
        let failed = false;
        await Promise.all(
          msg.attachments.map(async (att) => {
            if (!att.contentId || !current()) return;
            try {
              const url = await resolveScopedAttachment({
                queryClient,
                service: oxyServices,
                identity: scope.identity,
                lease,
                fileId: att.fileId,
                ownerCurrent,
                publish: true,
              });
              if (url && current()) cidMap[normalizeContentId(att.contentId)] = url;
            } catch {
              failed = true;
            }
          }),
        );
        if (current()) newEntries.push([msg._id, cidMap, failed]);
      }
      for (const msg of pending) ids.delete(msg._id);
      if (!current()) return;
      setStore((prev) => {
        if (!current()) return prev;
        const next = { ...(prev.scope === scope && prev.key === key ? prev.maps : NO_MAPS) };
        const nextFailures = {
          ...(prev.scope === scope && prev.key === key ? prev.failures : NO_FAILURES),
        };
        for (const [id, map, failed] of newEntries) {
          next[id] = map;
          if (failed) nextFailures[id] = reconnectEpoch;
          else delete nextFailures[id];
        }
        return { scope, key, maps: next, failures: nextFailures };
      });
    })();
  }, [
    messages,
    oxyServices,
    cidMaps,
    failures,
    reconnectEpoch,
    resetKey,
    queryClient,
    owner,
    scope,
    committed,
  ]);

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
