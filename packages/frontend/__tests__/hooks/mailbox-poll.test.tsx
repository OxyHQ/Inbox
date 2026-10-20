/**
 * The safety net under the socket. Every open list used to poll every page of
 * itself each minute, in background tabs too, beside a mailboxes poll. Now the
 * mailboxes are the only poll, and a folder's lists are re-read only when its
 * counts moved.
 */

import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { __setOxyState } from '@oxy.so/services/ui/client';

import { emailKeys } from '@/hooks/queries/queryKeys';
import { useMailboxPoll } from '@/hooks/queries/useMailboxes';

const box = (id: string, totalMessages: number, unseenMessages: number) => ({
  _id: id,
  totalMessages,
  unseenMessages,
});

function setup(server: () => unknown[]) {
  const client = new QueryClient();
  const key = emailKeys.mailboxes.list('u1');
  client.setQueryData(key, [box('inbox', 10, 2), box('sent', 5, 0)]);
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const refetch = jest.spyOn(client, 'refetchQueries').mockImplementation(async () => {
    client.setQueryData(key, server());
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper, invalidate, refetch };
}

beforeEach(() => {
  jest.useFakeTimers();
  __setOxyState({ user: { id: 'u1' } });
  focusManager.setFocused(true);
});

afterEach(() => {
  focusManager.setFocused(undefined);
  jest.useRealTimers();
});

it('re-reads the lists of a folder whose counts moved, and no other', async () => {
  const { wrapper, invalidate, refetch } = setup(() => [box('inbox', 11, 3), box('sent', 5, 0)]);
  renderHook(() => useMailboxPoll(), { wrapper });

  await act(async () => {
    await jest.advanceTimersByTimeAsync(60_000);
  });

  // One request, for the mailboxes; the inbox list is re-read because it moved.
  expect(refetch.mock.calls[0][0]).toMatchObject({ queryKey: ['mailboxes', 'u1'] });
  expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
    ['messages', 'inbox'],
  ]);
});

it('does not poll while the app is in the background', async () => {
  const { wrapper, refetch } = setup(() => []);
  focusManager.setFocused(false);
  renderHook(() => useMailboxPoll(), { wrapper });

  await act(async () => {
    await jest.advanceTimersByTimeAsync(120_000);
  });

  expect(refetch).not.toHaveBeenCalled();
});
