/**
 * Archive, Trash and the other moves take mail out of the list; Undo brings it
 * back — the rows where they were, and each message to the folder it left.
 */

const toast = Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() });
jest.mock('@oxy.so/bloom', () => ({ toast }));
const t = (key: string) => key;
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t }) }));

const moveMessage = jest.fn().mockResolvedValue(undefined);
const bulkMoveMessages = jest.fn().mockResolvedValue({ matched: 1, modified: 1 });
jest.mock('@/hooks/useEmail', () => {
  const state = { _api: { moveMessage, bulkMoveMessages }, selectedMessageId: null, viewMode: null };
  const useEmailStore = (selector: (s: unknown) => unknown) => selector(state);
  useEmailStore.getState = () => state;
  useEmailStore.setState = jest.fn();
  return { useEmailStore };
});

import React, { type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { __setOxyState } from '@oxy.so/services';

import { emailKeys } from '@/hooks/queries/queryKeys';
import { useArchiveMessage, useBulkMoveMessages } from '@/hooks/mutations/useMessageMutations';
import { MessageSchema, type Message } from '@/schemas/emailSchemas';
import type { MessagesInfinite } from '@/utils/messageCache';
import { wireMessage } from '../fixtures/wire';

function msg(id: string, mailboxId: string): Message {
  return MessageSchema.parse(wireMessage({ _id: id, id, mailboxId }));
}

function setup(...messages: Message[]) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: 0 } } });
  const list: MessagesInfinite = {
    pageParams: [undefined],
    pages: [{ data: messages, pagination: { total: messages.length, limit: 50, offset: 0, hasMore: false } }],
  };
  client.setQueryData(emailKeys.messages.root, list);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const ids = () => client.getQueryData<MessagesInfinite>(emailKeys.messages.root)?.pages[0].data.map((m) => m._id);
  return { client, wrapper, ids };
}

function undoAction(): () => void {
  const call = toast.success.mock.calls.at(-1);
  return (call?.[1] as { action: { onClick: () => void } }).action.onClick;
}

beforeEach(() => {
  jest.clearAllMocks();
  __setOxyState({ user: { id: 'u1' } });
});

it('offers Undo after archiving, which puts the row back and moves it to its folder', async () => {
  const { wrapper, ids } = setup(msg('a', 'inbox'), msg('b', 'inbox'));
  const { result } = renderHook(() => useArchiveMessage(), { wrapper });

  await act(async () => {
    await result.current.mutateAsync({ messageId: 'a', archiveMailboxId: 'archive', kind: 'archive' });
  });
  expect(ids()).toEqual(['b']);
  expect(toast.success).toHaveBeenCalledWith('ui.mutations.archived', expect.objectContaining({ action: expect.any(Object) }));

  act(() => undoAction()());
  expect(ids()).toEqual(['a', 'b']);
  await waitFor(() => expect(bulkMoveMessages).toHaveBeenCalledWith(['a'], 'inbox'));
});

it('returns each message of a bulk move to the folder it came from', async () => {
  const { wrapper } = setup(msg('a', 'inbox'), msg('b', 'work'));
  const { result } = renderHook(() => useBulkMoveMessages(), { wrapper });

  await act(async () => {
    await result.current.mutateAsync({ messageIds: ['a', 'b'], mailboxId: 'spam', kind: 'spam' });
  });
  expect(toast.success).toHaveBeenCalledWith('ui.mutations.movedToSpam', expect.any(Object));

  act(() => undoAction()());
  await waitFor(() => expect(bulkMoveMessages).toHaveBeenCalledTimes(3));
  expect(bulkMoveMessages).toHaveBeenCalledWith(['a'], 'inbox');
  expect(bulkMoveMessages).toHaveBeenCalledWith(['b'], 'work');
});

it('says Archived only for an archive: a single move to Spam says so', async () => {
  const { wrapper } = setup(msg('a', 'inbox'));
  const { result } = renderHook(() => useArchiveMessage(), { wrapper });
  await act(async () => {
    await result.current.mutateAsync({ messageId: 'a', archiveMailboxId: 'spam', kind: 'spam' });
  });
  expect(toast.success).toHaveBeenCalledWith('ui.mutations.movedToSpam', expect.any(Object));
});
