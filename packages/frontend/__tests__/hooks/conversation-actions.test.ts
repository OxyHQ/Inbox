/**
 * Actions on a conversation reach every message in it, and delete decides
 * "to Trash" or "for good" from where each message IS.
 */

const toggleRead = { mutate: jest.fn() };
const bulkFlags = { mutate: jest.fn() };
const deleteMutation = { mutate: jest.fn() };
const bulkDelete = { mutate: jest.fn() };
const archiveMutation = { mutate: jest.fn() };
const bulkMove = { mutate: jest.fn() };
const stub = { mutate: jest.fn() };
jest.mock('@/hooks/mutations/useMessageMutations', () => ({
  useToggleRead: () => toggleRead,
  useBulkUpdateFlags: () => bulkFlags,
  useDeleteMessage: () => deleteMutation,
  useBulkDeleteMessages: () => bulkDelete,
  useArchiveMessage: () => archiveMutation,
  useBulkMoveMessages: () => bulkMove,
  useToggleStar: () => stub,
  useTogglePin: () => stub,
  useSnoozeMessage: () => stub,
  useUnsnoozeMessage: () => stub,
}));
jest.mock('@/hooks/queries/useMailboxes', () => ({
  useMailboxes: () => ({
    data: [
      { _id: 'inbox', specialUse: '\\Inbox' },
      { _id: 'trash', specialUse: '\\Trash' },
      { _id: 'archive', specialUse: '\\Archive' },
    ],
  }),
}));
const t = (key: string) => key;
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t }) }));
jest.mock('@oxy.so/bloom', () => ({ toast: { error: jest.fn() } }));

import { renderHook } from '@testing-library/react';
import { useMessageActions } from '@/hooks/useMessageActions';
import type { Message } from '@/services/emailApi';

function msg(id: string, mailboxId: string, seen = true): Message {
  return {
    _id: id,
    mailboxId,
    flags: { seen, starred: false, answered: false, forwarded: false, draft: false, pinned: false },
  } as Message;
}

beforeEach(() => jest.clearAllMocks());

it('marks only the unread messages of a conversation read, in one request', () => {
  const { result } = renderHook(() => useMessageActions());
  result.current.setRead([msg('a', 'inbox', false), msg('b', 'inbox', true), msg('c', 'inbox', false)], true, { quiet: true });
  expect(bulkFlags.mutate).toHaveBeenCalledWith({ messageIds: ['a', 'c'], flags: { seen: true }, quiet: true });
});

it('archives every message of a conversation', () => {
  const { result } = renderHook(() => useMessageActions());
  result.current.archive([msg('a', 'inbox'), msg('b', 'inbox')]);
  expect(bulkMove.mutate).toHaveBeenCalledWith({ messageIds: ['a', 'b'], mailboxId: 'archive', kind: 'archive' });
});

it('deletes for good only what is already in Trash', () => {
  const { result } = renderHook(() => useMessageActions());
  result.current.deleteConversation([msg('a', 'inbox'), msg('b', 'trash')]);
  expect(bulkDelete.mutate).toHaveBeenCalledWith({ toTrash: ['a'], permanent: ['b'], trashMailboxId: 'trash' });
});

it('moves a single Inbox message to Trash, whatever folder was browsed last', () => {
  const { result } = renderHook(() => useMessageActions());
  result.current.deleteConversation([msg('a', 'inbox')]);
  expect(deleteMutation.mutate).toHaveBeenCalledWith({ messageId: 'a', trashMailboxId: 'trash', isInTrash: false });
});

it('moves an archived conversation back to the Inbox instead of archiving it again', () => {
  const { result } = renderHook(() => useMessageActions());
  const conversation = [msg('a', 'archive'), msg('b', 'archive')];
  expect(result.current.isArchived(conversation)).toBe(true);
  result.current.archive(conversation);
  expect(bulkMove.mutate).toHaveBeenCalledWith({ messageIds: ['a', 'b'], mailboxId: 'inbox', kind: 'inbox' });
});

it('archives a conversation only partly in Archive', () => {
  const { result } = renderHook(() => useMessageActions());
  const conversation = [msg('a', 'archive'), msg('b', 'inbox')];
  expect(result.current.isArchived(conversation)).toBe(false);
  result.current.archive(conversation);
  expect(bulkMove.mutate).toHaveBeenCalledWith({ messageIds: ['a', 'b'], mailboxId: 'archive', kind: 'archive' });
});
