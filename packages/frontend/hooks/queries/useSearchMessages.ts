import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { useOxy } from '@oxyhq/services';
import { useEmailStore } from '@/hooks/useEmail';
import { emailKeys } from '@/hooks/queries/queryKeys';
import type { Message, Pagination } from '@/services/emailApi';

const SEARCH_PAGE_SIZE = 50;

export interface SearchOptions {
  q?: string;
  from?: string;
  to?: string;
  subject?: string;
  hasAttachment?: boolean;
  dateAfter?: string;
  dateBefore?: string;
  mailbox?: string;
  starred?: boolean;
  unread?: boolean;
  label?: string;
}

export interface SearchPage {
  data: Message[];
  pagination: Pagination;
}

export function getNextSearchPageParam(lastPage: SearchPage): string | number | undefined {
  if (!lastPage.pagination.hasMore || lastPage.pagination.limit <= 0) return undefined;

  if (lastPage.pagination.nextCursor) return lastPage.pagination.nextCursor;

  const nextOffset = lastPage.pagination.offset + lastPage.pagination.limit;
  return nextOffset < lastPage.pagination.total ? nextOffset : undefined;
}

export function useSearchMessages(options: SearchOptions = {}) {
  const api = useEmailStore((s) => s._api);
  const { user } = useOxy();
  const userId = user?.id ?? null;

  const hasFilter = !!(
    options.q?.trim() ||
    options.from?.trim() ||
    options.to?.trim() ||
    options.subject?.trim() ||
    options.hasAttachment ||
    options.dateAfter ||
    options.dateBefore ||
    options.mailbox?.trim() ||
    options.starred ||
    typeof options.unread === 'boolean' ||
    options.label?.trim()
  );

  return useInfiniteQuery<SearchPage, Error, InfiniteData<SearchPage, string | number>, ReturnType<typeof emailKeys.search>, string | number>({
    queryKey: emailKeys.search(options, userId),
    queryFn: async ({ pageParam = '' }) => {
      if (!api) throw new Error('Email API not initialized');
      return await api.search({
        ...options,
        limit: SEARCH_PAGE_SIZE,
        ...(typeof pageParam === 'string' ? { cursor: pageParam } : { offset: pageParam }),
      });
    },
    initialPageParam: '',
    getNextPageParam: getNextSearchPageParam,
    enabled: hasFilter && !!api && !!userId,
  });
}
