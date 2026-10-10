import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { useEmailStore } from '@/hooks/useEmail';
import { emailKeys } from '@/hooks/queries/queryKeys';
import type { Contact, Pagination } from '@/services/emailApi';

/**
 * The API clamps `limit` to 100 (`listContacts` in oxy-api). This hook used to
 * ask for 200 in one non-paginated read, got 100, and dropped the pagination —
 * so the 101st contact could never be seen, edited or deleted.
 */
export const CONTACTS_PAGE_SIZE = 100;

export interface ContactsPage {
  data: Contact[];
  pagination: Pagination;
}

export type ContactsInfinite = InfiniteData<ContactsPage, number>;

/**
 * The offset of the page after `lastPage`, or `undefined` when there is none.
 * Offset pagination: `{ total, limit, offset, hasMore }`.
 */
export function nextContactsOffset(lastPage: ContactsPage): number | undefined {
  const { hasMore, offset, limit } = lastPage.pagination;
  if (!hasMore) return undefined;
  // A page that came back empty while claiming more would loop forever.
  if (lastPage.data.length === 0) return undefined;
  return offset + Math.max(limit, lastPage.data.length);
}

/**
 * The user's saved contacts, optionally filtered by a search query, one page
 * of {@link CONTACTS_PAGE_SIZE} at a time.
 */
export function useContacts(query?: string) {
  const api = useEmailStore((s) => s._api);
  const q = query?.trim() || undefined;

  return useInfiniteQuery<ContactsPage, Error, ContactsInfinite, readonly unknown[], number>({
    queryKey: emailKeys.contacts.list(q),
    queryFn: async ({ pageParam }) => {
      if (!api) throw new Error('Email API not initialized');
      return api.listContacts({ q, limit: CONTACTS_PAGE_SIZE, offset: pageParam });
    },
    initialPageParam: 0,
    getNextPageParam: nextContactsOffset,
    enabled: !!api,
    placeholderData: (prev) => prev,
  });
}
