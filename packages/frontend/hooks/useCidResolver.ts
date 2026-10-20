/**
 * Hook to resolve CID inline image references in email HTML.
 *
 * Fetches signed File Manager URLs for inline attachments and replaces cid:
 * references in the HTML with the actual URLs. Returns a stable map of
 * messageId → resolvedHtml.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { OxyServices } from '@oxy.so/core';
import { ATTACHMENT_URL_STALE_MS } from '@/hooks/queries/useAttachmentUrl';
import { emailKeys } from '@/hooks/queries/queryKeys';
import type { Message } from '@/services/emailApi';
import { normalizeContentId, resolveCidImages } from '@/utils/htmlTransform';

type CidMaps = Record<string, Record<string, string>>;

/** What a message that has not resolved yet reads: one object, so memos stay put. */
const NO_MAPS: CidMaps = {};

export function useCidResolver(
  messages: Message[],
  oxyServices: OxyServices | null | undefined,
  resetKey: string,
): Record<string, string> {
  const queryClient = useQueryClient();
  // The maps belong to the message they were resolved for. When the displayed
  // message changes they are simply not read any more — derived during render,
  // so the first render of the new message already has none. Clearing them in
  // an effect instead rendered the new message once with the old maps, then
  // again without them.
  const [store, setStore] = useState<{ key: string; maps: CidMaps }>(() => ({
    key: resetKey,
    maps: NO_MAPS,
  }));
  const cidMaps = store.key === resetKey ? store.maps : NO_MAPS;
  // The message on screen as of the last commit. A lookup that finishes after
  // the user moved to another message is dropped.
  const shownKey = useRef(resetKey);
  // Messages whose lookup is under way, for the message they belong to. A
  // message counts as resolved only once its map is stored: marking it before
  // the lookup finished meant a lookup cancelled by a thread refetch was never
  // retried, and the images of the message the user opened stayed broken.
  const inFlight = useRef({ key: resetKey, ids: new Set<string>() });

  useEffect(() => {
    shownKey.current = resetKey;
  }, [resetKey]);

  // Fetch signed File Manager URLs for inline CID attachments
  useEffect(() => {
    if (!oxyServices) return;
    const key = resetKey;
    if (inFlight.current.key !== key) inFlight.current = { key, ids: new Set() };
    const ids = inFlight.current.ids;
    const pending = messages.filter(
      (msg) =>
        !(msg._id in cidMaps) &&
        !ids.has(msg._id) &&
        // Referenced by Content-ID, whatever its disposition says.
        msg.attachments.some((a) => a.contentId),
    );
    if (pending.length === 0) return;
    for (const msg of pending) ids.add(msg._id);

    (async () => {
      const newEntries: [string, Record<string, string>][] = [];
      for (const msg of pending) {
        const cidMap: Record<string, string> = {};
        await Promise.all(
          msg.attachments.map(async (att) => {
            if (!att.contentId) return;
            try {
              // Through the same query as `useAttachmentUrl`: the signed URL of
              // an image is asked for once while it is fresh, not again every
              // time the message is opened or its thread refetched.
              cidMap[normalizeContentId(att.contentId)] = await queryClient.fetchQuery({
                queryKey: emailKeys.attachmentUrl(att.fileId),
                queryFn: () => oxyServices.assets.url(att.fileId),
                staleTime: ATTACHMENT_URL_STALE_MS,
              });
            } catch {
              /* that image stays a cid: reference */
            }
          }),
        );
        newEntries.push([msg._id, cidMap]);
      }
      for (const msg of pending) ids.delete(msg._id);
      if (shownKey.current !== key) return;
      setStore((prev) => {
        const next = { ...(prev.key === key ? prev.maps : NO_MAPS) };
        for (const [id, map] of newEntries) next[id] = map;
        return { key, maps: next };
      });
    })();
  }, [messages, oxyServices, cidMaps, resetKey, queryClient]);

  // Pre-compute resolved HTML per message — stable references
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
