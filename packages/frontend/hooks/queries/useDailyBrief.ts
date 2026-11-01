/**
 * The daily AI brief: a short summary of today's Inbox and the messages
 * it names, written in the UI language.
 *
 * Fetched while the Inbox is visible and the `aiBrief` preference is on,
 * and kept per user, day and language for half an hour.
 */

import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOxy } from '@oxy.so/services/ui/client';
import { useLocale } from '@/lib/i18n';
import { useObservedInferenceOwner } from '@/hooks/queries/useObservedInferenceOwner';
import { runObservedInference } from '@/hooks/queries/runObservedInference';
import {
  fetchInboxDailyBrief,
  inboxLocalDayWindow,
  type InboxDailyBrief,
} from '@/services/inboxInferenceApi';

const BRIEF_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

class DailyBriefObsoleteError extends Error {
  constructor() {
    super('Daily brief session changed.');
    this.name = 'DailyBriefObsoleteError';
  }
}

export function useDailyBrief({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();
  const { oxyServices, user, canUsePrivateApi, isAccountCacheReady } = useOxy();
  const accountReady = canUsePrivateApi && isAccountCacheReady;
  const owner = useObservedInferenceOwner();
  const { locale } = useLocale();

  // The API receives the exact UTC instants bounding the user's local calendar
  // day. This remains correct across 23/25-hour daylight-saving transitions.
  const { day, startAt, endAt } = inboxLocalDayWindow();
  const userId = user?.id ?? null;
  // Briefs hold private account content, so a same-day account switch must
  // never reuse another account's entry; a language switch is another brief.
  const queryKey = useMemo(
    () => ['daily-brief', userId, day, locale, 'content-actions-v1'] as const,
    [day, locale, userId],
  );
  const scope = JSON.stringify([
    userId,
    day,
    locale,
    accountReady,
    owner.binding,
    owner.subject,
    owner.sessionId,
    owner.revision,
    owner.epoch,
    owner.knownSubject,
    owner.authenticated,
  ]);
  const binding = useMemo(() => ({ scope }), [scope]);
  const committedBinding = useRef<typeof binding | null>(null);
  useLayoutEffect(() => {
    committedBinding.current = binding;
    return () => {
      if (committedBinding.current === binding) committedBinding.current = null;
    };
  }, [binding]);
  const canAct = useCallback(
    () => committedBinding.current === binding && accountReady && owner.isCurrent(),
    [binding, accountReady, owner],
  );
  const actionsReady = accountReady && owner.ready;

  const query = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      try {
        return await runObservedInference(owner, signal, (requestSignal) =>
          fetchInboxDailyBrief(oxyServices.http, { startAt, endAt, locale }, requestSignal),
        );
      } catch (error) {
        if (!owner.isCurrent() || signal.aborted) {
          throw new DailyBriefObsoleteError();
        }
        throw error;
      }
    },
    enabled: enabled && actionsReady && userId !== null,
    staleTime: BRIEF_CACHE_TTL,
    gcTime: BRIEF_CACHE_TTL,
    // A failed brief is shown with Retry rather than re-asked behind the reader.
    retry: false,
    refetchOnWindowFocus: false,
  });

  /** Opening a message from the brief reads it: the row stops showing unread. */
  const markOpened = useCallback(
    (messageId: string) => {
      if (!canAct()) return;
      queryClient.setQueryData<InboxDailyBrief>(
        queryKey,
        (brief) =>
          brief && {
            ...brief,
            items: brief.items.map((item) =>
              item.messageId === messageId ? { ...item, unread: false } : item,
            ),
          },
      );
    },
    [canAct, queryClient, queryKey],
  );
  const regenerate = useCallback(() => {
    if (!canAct()) return Promise.resolve(undefined);
    return query.refetch();
  }, [canAct, query.refetch]);

  return {
    brief: accountReady ? query.data : undefined,
    isLoading: query.isFetching && !query.data,
    error: query.error instanceof DailyBriefObsoleteError ? null : query.error,
    regenerate,
    markOpened,
    canAct,
    actionsReady,
  };
}
