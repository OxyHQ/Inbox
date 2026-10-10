/**
 * The message list on screen: which list the current view shows, its messages,
 * and the rows they are displayed as.
 *
 * One definition for the list and for everything that walks it. The keyboard
 * shortcuts derived their own — always the Inbox, never collapsed — so in
 * Starred or a label `j` jumped into the Inbox, and in conversation view it
 * stepped into the hidden older messages of the conversation on screen.
 */

import { useCallback, useMemo } from 'react';

import { SPECIAL_USE } from '@/constants/mailbox';
import { useMailboxes } from '@/hooks/queries/useMailboxes';
import { useMessages } from '@/hooks/queries/useMessages';
import { useEmailStore } from '@/hooks/useEmail';
import { useInboxDisplayPrefs } from '@/hooks/useInboxDisplayPrefs';
import type { Message } from '@/services/emailApi';
import { groupThreads } from '@/utils/threadGrouping';

export function useCurrentList() {
  const viewMode = useEmailStore((s) => s.viewMode);
  const currentMailbox = useEmailStore((s) => s.currentMailbox);
  const { conversationView } = useInboxDisplayPrefs();
  const { data: mailboxes = [] } = useMailboxes();

  /**
   * Falls back to the Inbox when nothing has been selected yet.
   *
   * The route→store sync lives in `MailboxView`, which renders inside the
   * detail `<Slot/>`. On desktop that Slot is only mounted when a message is
   * open, so without this fallback the list would sit empty on first load —
   * `useMessages` is gated on `enabled: hasFilter`, and no mailbox id means no
   * request at all.
   */
  const inboxMailboxId = useMemo(
    () => mailboxes.find((m) => m.specialUse === SPECIAL_USE.INBOX)?._id,
    [mailboxes],
  );

  const options = useMemo(() => {
    if (!viewMode) return { mailboxId: currentMailbox?._id ?? inboxMailboxId };
    switch (viewMode.type) {
      case 'mailbox':
        return { mailboxId: viewMode.mailbox._id };
      case 'starred':
        return { starred: true };
      case 'label':
        return { label: viewMode.labelName };
    }
  }, [viewMode, currentMailbox, inboxMailboxId]);

  const query = useMessages(options);
  const { data } = query;

  // Each message once. Pages are cursor-based, so a message that moved up the
  // list after its page was fetched (unpinned, a flag changed the order) comes
  // back on the next page too — and a duplicated id is a duplicated row key and
  // a conversation counted twice.
  const messages = useMemo(() => {
    const seen = new Set<string>();
    return (data?.pages.flatMap((p) => p.data) ?? []).filter((m) => {
      if (seen.has(m._id)) return false;
      seen.add(m._id);
      return true;
    });
  }, [data]);
  const unreadable = useMemo(() => data?.pages.flatMap((p) => p.unreadable ?? []) ?? [], [data]);

  // Thread grouping is a post-process over the fetched list (single query, no
  // duplicate list): one row per conversation when the pref is on.
  const threadGroups = useMemo(
    () =>
      conversationView
        ? groupThreads(messages)
        : messages.map((message) => ({ row: message, members: [message] })),
    [messages, conversationView],
  );
  const rows = useMemo(() => threadGroups.map((group) => group.row), [threadGroups]);
  const membersByRowId = useMemo(
    () => new Map(threadGroups.map((group) => [group.row._id, group.members])),
    [threadGroups],
  );
  /** Everything a row stands for: the whole conversation in conversation view. */
  const conversationOf = useCallback(
    (rowId: string): Message[] =>
      membersByRowId.get(rowId) ?? messages.filter((m) => m._id === rowId),
    [membersByRowId, messages],
  );

  /** Something to list: false while the view's mailbox id is still unknown. */
  const listReady = Boolean(options.mailboxId || options.starred || options.label);

  /** The route of this list, for leaving a conversation back to it. */
  const viewHref = useMemo(() => {
    if (viewMode?.type === 'starred') return '/starred';
    if (viewMode?.type === 'label') return `/label/${encodeURIComponent(viewMode.labelName)}`;
    const mailbox = viewMode?.type === 'mailbox' ? viewMode.mailbox : currentMailbox;
    if (!mailbox || mailbox.specialUse === SPECIAL_USE.INBOX) return '/';
    const view = SPECIAL_USE_TO_VIEW[mailbox.specialUse ?? ''];
    return `/${view ?? mailbox._id}`;
  }, [viewMode, currentMailbox]);

  return { query, options, listReady, messages, unreadable, rows, conversationOf, viewHref };
}

/** The `[view]` route segment of each system mailbox. */
const SPECIAL_USE_TO_VIEW: Record<string, string> = {
  [SPECIAL_USE.SENT]: 'sent',
  [SPECIAL_USE.DRAFTS]: 'drafts',
  [SPECIAL_USE.TRASH]: 'trash',
  [SPECIAL_USE.SPAM]: 'spam',
  [SPECIAL_USE.ARCHIVE]: 'archive',
  [SPECIAL_USE.SNOOZED]: 'snoozed',
};
