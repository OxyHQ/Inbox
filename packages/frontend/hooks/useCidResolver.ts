/**
 * Hook to resolve CID inline image references in email HTML.
 *
 * Fetches signed File Manager URLs for inline attachments and replaces cid:
 * references in the HTML with the actual URLs. Returns a stable map of
 * messageId → resolvedHtml.
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import type { OxyServices } from '@oxy.so/core';
import type { Message } from '@/services/emailApi';
import { normalizeContentId, resolveCidImages } from '@/utils/htmlTransform';

export function useCidResolver(
  messages: Message[],
  oxyServices: OxyServices | null | undefined,
  resetKey: string,
): Record<string, string> {
  const [cidMaps, setCidMaps] = useState<Record<string, Record<string, string>>>({});
  // Messages whose lookup is under way. A message counts as resolved only once
  // its map is stored: marking it before the lookup finished meant a lookup
  // cancelled by a thread refetch was never retried, and the images of the
  // message the user opened stayed broken.
  const inFlight = useRef(new Set<string>());
  // Bumped when the displayed message changes: a lookup started before that
  // belongs to another message and is dropped. Nothing else drops a lookup.
  const generation = useRef(0);

  // Reset when the displayed message changes
  useEffect(() => {
    generation.current += 1;
    setCidMaps({});
    inFlight.current = new Set();
  }, [resetKey]);

  // Fetch signed File Manager URLs for inline CID attachments
  useEffect(() => {
    if (!oxyServices) return;
    const started = generation.current;
    const pending = messages.filter(
      (msg) =>
        !(msg._id in cidMaps) &&
        !inFlight.current.has(msg._id) &&
        // Referenced by Content-ID, whatever its disposition says.
        msg.attachments.some((a) => a.contentId),
    );
    if (pending.length === 0) return;
    for (const msg of pending) inFlight.current.add(msg._id);

    (async () => {
      const newEntries: [string, Record<string, string>][] = [];
      for (const msg of pending) {
        const cidMap: Record<string, string> = {};
        await Promise.all(
          msg.attachments.map(async (att) => {
            if (!att.contentId) return;
            try {
              cidMap[normalizeContentId(att.contentId)] = await oxyServices.assets.url(att.fileId);
            } catch { /* that image stays a cid: reference */ }
          }),
        );
        newEntries.push([msg._id, cidMap]);
      }
      if (generation.current !== started) return;
      for (const msg of pending) inFlight.current.delete(msg._id);
      setCidMaps((prev) => {
        const next = { ...prev };
        for (const [id, map] of newEntries) next[id] = map;
        return next;
      });
    })();
  }, [messages, oxyServices, cidMaps]);

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
