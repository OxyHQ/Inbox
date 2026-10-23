import { focusManager, type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useOxy } from '@oxy.so/services/ui/client';
import { useEmailApi } from '@/hooks/useEmailApi';
import { emailKeys } from '@/hooks/queries/queryKeys';
import type { Mailbox } from '@/services/emailApi';

/**
 * Re-read the lists of every folder whose counts moved since the last read:
 * mail arrived, left or changed there without this client hearing of it.
 */
export function reconcileMovedFolders(
  queryClient: QueryClient,
  previous: readonly Mailbox[] | undefined,
  next: readonly Mailbox[] | undefined,
): void {
  if (!previous || !next) return;
  const before = new Map(previous.map((mailbox) => [mailbox._id, mailbox]));
  for (const mailbox of next) {
    const was = before.get(mailbox._id);
    if (
      was &&
      (was.totalMessages !== mailbox.totalMessages || was.unseenMessages !== mailbox.unseenMessages)
    ) {
      void queryClient.invalidateQueries({
        queryKey: emailKeys.messages.mailboxScope(mailbox._id),
      });
    }
  }
}

export function useMailboxes({ enabled = true }: { enabled?: boolean } = {}) {
  const api = useEmailApi();
  const { user } = useOxy();
  const userId = user?.id ?? null;

  return useQuery<Mailbox[], Error, Mailbox[] | undefined>({
    select: (data) => (api ? data : undefined),
    queryKey: emailKeys.mailboxes.list(userId),
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Email API not initialized');
      return await api.listMailboxes({ signal });
    },
    enabled: enabled && !!api && !!userId,
  });
}

const MAILBOX_POLL_MS = 60_000;

/**
 * The safety net under `useInboxSocket`: the mailboxes, re-read once a minute,
 * and the lists of a folder whose counts moved (`reconcileMovedFolders`). Mount
 * once.
 *
 * It used to be a 60 s `refetchInterval` on the mailboxes AND on every open
 * list, every page of it, kept ticking in background tabs. Now it is one
 * request a minute, none while the app is in the background: coming back is a
 * focus, which re-reads the stale lists and counts at once — so the new mail
 * is there on return, never "until you reload".
 */
export function useMailboxPoll(): void {
  const queryClient = useQueryClient();
  const { user } = useOxy();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    const key = emailKeys.mailboxes.list(userId);
    const timer = setInterval(() => {
      if (!focusManager.isFocused()) return;
      const previous = queryClient.getQueryData<Mailbox[]>(key);
      void queryClient
        .refetchQueries({ queryKey: key, exact: true, type: 'active' })
        .then(() => reconcileMovedFolders(queryClient, previous, queryClient.getQueryData(key)));
    }, MAILBOX_POLL_MS);
    return () => clearInterval(timer);
  }, [queryClient, userId]);
}
