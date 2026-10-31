import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { useOxy } from '@oxy.so/services/ui/client';
import { useEmailStore } from '@/hooks/useEmail';
import { emailKeys } from '@/hooks/queries/queryKeys';
import { nextMessagePage } from '@/hooks/queries/messagePagination';
import type { Message, Pagination, UnreadableMessage } from '@/services/emailApi';

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
  /** Results the client could not read; the list shows them degraded. */
  unreadable?: UnreadableMessage[];
  pagination: Pagination;
}

export function getNextSearchPageParam(
  lastPage: SearchPage,
  _allPages?: SearchPage[],
  _lastPageParam?: string | number,
  pageParams: (string | number)[] = [],
): string | number | undefined {
  return nextMessagePage(lastPage.pagination, pageParams);
}

export function useSearchMessages(
  options: SearchOptions = {},
  { enabled = true }: { enabled?: boolean } = {},
) {
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

  return useInfiniteQuery<
    SearchPage,
    Error,
    InfiniteData<SearchPage, string | number>,
    ReturnType<typeof emailKeys.search>,
    string | number
  >({
    queryKey: emailKeys.search(options, userId),
    queryFn: async ({ pageParam = '', signal }) => {
      if (!api) throw new Error('Email API not initialized');
      return await api.search(
        {
          ...options,
          limit: SEARCH_PAGE_SIZE,
          ...(typeof pageParam === 'string' ? { cursor: pageParam } : { offset: pageParam }),
        },
        { signal },
      );
    },
    initialPageParam: '',
    getNextPageParam: getNextSearchPageParam,
    enabled: enabled && hasFilter && !!api && !!userId,
  });
}
