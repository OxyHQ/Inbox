/**
 * The opt-in daily AI brief: a short summary of today's Inbox and the messages
 * it names, written in the UI language.
 *
 * Fetched only while the caller enables it (the brief is open and the `aiBrief`
 * pref is on) and kept per user, day and language for half an hour.
 */

import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOxy } from '@oxy.so/services';
import { useLocale } from '@/lib/i18n';
import {
  fetchInboxDailyBrief,
  inboxLocalDayWindow,
  type InboxDailyBrief,
} from '@/services/inboxInferenceApi';

const BRIEF_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export function useDailyBrief({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();
  const { oxyServices, user } = useOxy();
  const { locale } = useLocale();

  // The API receives the exact UTC instants bounding the user's local calendar
  // day. This remains correct across 23/25-hour daylight-saving transitions.
  const { day, startAt, endAt } = inboxLocalDayWindow();
  const userId = user?.id ?? null;
  // Briefs hold private account content, so a same-day account switch must
  // never reuse another account's entry; a language switch is another brief.
  const queryKey = useMemo(() => ['daily-brief', userId, day, locale] as const, [day, locale, userId]);

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      fetchInboxDailyBrief(oxyServices.http, { startAt, endAt, locale }, signal),
    enabled: enabled && userId !== null,
    staleTime: BRIEF_CACHE_TTL,
    gcTime: BRIEF_CACHE_TTL,
    // A failed brief is shown with Retry rather than re-asked behind the reader.
    retry: false,
    refetchOnWindowFocus: false,
  });

  /** Opening a message from the brief reads it: the row stops showing unread. */
  const markOpened = useCallback(
    (messageId: string) => {
      queryClient.setQueryData<InboxDailyBrief>(queryKey, (brief) =>
        brief && {
          ...brief,
          items: brief.items.map((item) =>
            item.messageId === messageId ? { ...item, unread: false } : item,
          ),
        },
      );
    },
    [queryClient, queryKey],
  );

  return {
    brief: query.data,
    isLoading: query.isFetching && !query.data,
    error: query.error,
    regenerate: query.refetch,
    markOpened,
  };
}
