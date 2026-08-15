import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { useOxy } from '@oxyhq/services';
import { useEmailStore } from '@/hooks/useEmail';
import { emailKeys } from '@/hooks/queries/queryKeys';
import type { Message, Pagination } from '@/services/emailApi';

const PAGE_SIZE = 50;

interface MessagesPage {
  data: Message[];
  pagination: Pagination;
}

export function getNextMessagesPageParam(lastPage: MessagesPage): string | number | undefined {
  if (!lastPage.pagination.hasMore || lastPage.pagination.limit <= 0) return undefined;
  if (lastPage.pagination.nextCursor) return lastPage.pagination.nextCursor;
  const nextOffset = lastPage.pagination.offset + lastPage.pagination.limit;
  return nextOffset < lastPage.pagination.total ? nextOffset : undefined;
}

interface UseMessagesOptions {
  mailboxId?: string;
  starred?: boolean;
  label?: string;
}

export function useMessages(options: UseMessagesOptions = {}) {
  const { mailboxId, starred, label } = options;
  const api = useEmailStore((s) => s._api);
  const { user } = useOxy();
  const userId = user?.id ?? null;

  const hasFilter = !!mailboxId || !!starred || !!label;

  return useInfiniteQuery<MessagesPage, Error, InfiniteData<MessagesPage, string | number>, ReturnType<typeof emailKeys.messages.list>, string | number>({
    queryKey: emailKeys.messages.list({ mailboxId, starred, label, userId }),
    queryFn: async ({ pageParam = '' }) => {
      if (!api) throw new Error('Email API not initialized');
      return await api.listMessages({
        mailboxId,
        starred,
        label,
        limit: PAGE_SIZE,
        ...(typeof pageParam === 'string' ? { cursor: pageParam } : { offset: pageParam }),
      });
    },
    initialPageParam: '',
    getNextPageParam: getNextMessagesPageParam,
    enabled: hasFilter && !!api && !!userId,
    refetchInterval: 60_000, // Poll for new messages every 60 seconds
  });
}
