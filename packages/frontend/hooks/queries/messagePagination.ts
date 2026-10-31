import { nextUnvisitedCursor } from '@oxy.so/utils/paging';
import type { Pagination } from '@/services/emailApi';

/** Preserve offset fallback only when the server supplies no cursor. */
export function nextMessagePage(
  pagination: Pagination,
  pageParams: readonly (string | number)[],
): string | number | undefined {
  if (!pagination.hasMore || pagination.limit <= 0) return undefined;

  if (pagination.nextCursor != null) {
    return nextUnvisitedCursor(
      pagination.nextCursor,
      pageParams.filter((param): param is string => typeof param === 'string'),
    );
  }

  const nextOffset = pagination.offset + pagination.limit;
  return nextOffset < pagination.total && !pageParams.includes(nextOffset) ? nextOffset : undefined;
}
