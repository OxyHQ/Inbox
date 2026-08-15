/**
 * Hook to identify sent emails that may need follow-up.
 *
 * Cross-references the already-cached Inbox messages with the Sent mailbox
 * query to exclude threads that already have replies.
 */

import { useMemo } from 'react';
import { useMessages } from '@/hooks/queries/useMessages';
import { useMailboxes } from '@/hooks/queries/useMailboxes';
import { SPECIAL_USE } from '@/constants/mailbox';
import type { Message } from '@/services/emailApi';
import type { Commitment } from './useCommitmentDetection';

// Re-export commitment detection for use with follow-up messages
export { useCommitmentReminders } from './useCommitmentDetection';
export type { Commitment };

export interface FollowUpMessage extends Message {
  commitments?: Commitment[];
}

interface UseFollowUpResult {
  messages: FollowUpMessage[];
  count: number;
  isLoading: boolean;
}

export type FollowUpReason = 'awaiting-reply';

// Days without reply to consider for follow-up.
export const FOLLOW_UP_DAYS = 3;

const NO_REPLY_PATTERN = /(?:^|[+._-])(?:no[-_.]?reply|noreply|donotreply)(?:@|$)/i;

function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(?:(?:re|fw|fwd)\s*:\s*)+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function hasReplyForMessage(message: Message, inboxMessages: Message[] | undefined): boolean {
  if (!inboxMessages || inboxMessages.length === 0) return false;

  const messageIds = new Set(
    [message.messageId, ...(message.references ?? [])].filter((id): id is string => Boolean(id)),
  );
  const subject = normalizeSubject(message.subject);
  const recipients = new Set(message.to.map((address) => address.address.toLowerCase()));

  return inboxMessages.some((reply) => {
    if (reply.inReplyTo && messageIds.has(reply.inReplyTo)) return true;
    if ((reply.references ?? []).some((reference) => messageIds.has(reference))) return true;

    // Some providers omit References. Only use subject matching when the
    // incoming sender was one of the original recipients, reducing accidental
    // matches between unrelated conversations with the same subject.
    return (
      subject.length > 0 &&
      normalizeSubject(reply.subject) === subject &&
      recipients.has(reply.from.address.toLowerCase())
    );
  });
}

/** Explain why a sent message is a follow-up candidate, or return null. */
export function getFollowUpReason(
  message: Message,
  inboxMessages: Message[] | undefined,
  now = new Date(),
): FollowUpReason | null {
  const messageTime = new Date(message.date).getTime();
  const cutoff = now.getTime() - FOLLOW_UP_DAYS * 24 * 60 * 60 * 1000;
  if (!Number.isFinite(messageTime) || messageTime > cutoff) return null;

  const toAddresses = message.to.map((address) => address.address.toLowerCase());
  if (toAddresses.some((address) => NO_REPLY_PATTERN.test(address))) return null;
  if (hasReplyForMessage(message, inboxMessages)) return null;

  return 'awaiting-reply';
}

function conversationKey(message: Message): string {
  const reference = message.references?.[0];
  if (reference) return `reference:${reference}`;
  return `subject:${normalizeSubject(message.subject)}|to:${message.to
    .map((address) => address.address.toLowerCase())
    .sort()
    .join(',')}`;
}

interface UseFollowUpOptions {
  /** Avoid loading Sent when the main list is not the Inbox. */
  enabled?: boolean;
}

/**
 * @param inboxMessages — already-cached inbox messages used to detect replies
 * @param limit — max number of follow-up candidates to return
 */
export function useFollowUp(
  inboxMessages: Message[] | undefined,
  limit = 5,
  options: UseFollowUpOptions = {},
): UseFollowUpResult {
  const enabled = options.enabled ?? inboxMessages !== undefined;
  const { data: mailboxes = [] } = useMailboxes();
  const sentMailboxId = useMemo(
    () => mailboxes.find(m => m.specialUse === SPECIAL_USE.SENT)?._id,
    [mailboxes]
  );

  const { data, isLoading } = useMessages(
    enabled && sentMailboxId ? { mailboxId: sentMailboxId } : {},
  );

  const result = useMemo(() => {
    if (!enabled || !data || isLoading) {
      return { messages: [], count: 0 };
    }

    const allSentMessages = data.pages.flatMap(p => p.data);
    const needsFollowUp = allSentMessages.filter(
      (message) => getFollowUpReason(message, inboxMessages) !== null,
    );

    // Sort by date descending (most recent first)
    const sorted = [...needsFollowUp].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Multiple sent messages in one conversation should not create a stack of
    // identical actions. Keep the latest candidate and explain the thread once.
    const seenConversations = new Set<string>();
    const unique = sorted.filter((message) => {
      const key = conversationKey(message);
      if (seenConversations.has(key)) return false;
      seenConversations.add(key);
      return true;
    });

    return {
      messages: unique.slice(0, Math.max(0, limit)),
      count: unique.length,
    };
  }, [data, enabled, inboxMessages, isLoading, limit]);

  return {
    ...result,
    isLoading: enabled && isLoading,
  };
}
