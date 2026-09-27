/**
 * The message a composer is replying to, reduced to what sending needs: its
 * RFC threading headers, and whether they are known yet.
 *
 * A reply must never leave without them. One that did was written with
 * `In-Reply-To: <row-uuid>` and landed outside its conversation on both
 * sides, so while the parent is loading — or failed to load — the composer
 * refuses to send rather than sending an unthreaded reply.
 */

import { useMessage } from '@/hooks/queries/useMessage';
import { buildReplyHeaders, type ReplyHeaders } from '@/utils/replyHeaders';

export type ReplyParentState =
  /** Not a reply. Nothing to wait for. */
  | { status: 'none'; headers: undefined; blocksSend: false; retry: () => void }
  | { status: 'loading'; headers: undefined; blocksSend: true; retry: () => void }
  | { status: 'error'; headers: undefined; blocksSend: true; retry: () => void }
  | { status: 'ready'; headers: ReplyHeaders; blocksSend: false; retry: () => void };

export function useReplyParent(replyTo: string | undefined): ReplyParentState {
  const query = useMessage(replyTo);
  const retry = () => {
    void query.refetch();
  };

  if (!replyTo) return { status: 'none', headers: undefined, blocksSend: false, retry };
  if (query.data) {
    return { status: 'ready', headers: buildReplyHeaders(query.data), blocksSend: false, retry };
  }
  // `isError`, and also a query that settled with no message: either way the
  // headers are unknown and the reply cannot be threaded.
  if (query.isError || (!query.isFetching && query.isFetched)) {
    return { status: 'error', headers: undefined, blocksSend: true, retry };
  }
  return { status: 'loading', headers: undefined, blocksSend: true, retry };
}
