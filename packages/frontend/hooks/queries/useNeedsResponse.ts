/**
 * Hook to identify emails that need a response from the user.
 *
 * Uses small, explainable signals to detect unread emails that contain a
 * direct question or request. The signal is returned with each result so the
 * list can explain why it was promoted instead of presenting a silent label.
 */

import { useMemo } from 'react';
import type { Message } from '@/services/emailApi';

export type NeedsResponseReason = 'question' | 'request' | 'waiting';

interface UseNeedsResponseResult {
  messages: Message[];
  count: number;
  reasons: Map<string, NeedsResponseReason>;
}

const DIRECT_REQUEST_PATTERNS = [
  /\b(?:could|would|can) you\b/i,
  /\bplease\s+(?:let|send|share|confirm|provide|review|reply)\b/i,
  /\b(?:get back to|let me know|what do you think|when can you)\b/i,
  /\b(?:rsvp|confirm(?:ation)?)\b/i,
];

const WAITING_PATTERN = /\bwaiting for (?:your|a) (?:response|reply)\b/i;
const QUESTION_PATTERN = /\?/;

// Patterns that suggest an email is just informational (no response needed)
const INFORMATIONAL_PATTERNS = [
  /no (reply|response) (needed|required)/i,
  /fyi/i,
  /for your (information|records)/i,
  /newsletter/i,
  /unsubscribe/i,
  /noreply|no-reply|donotreply/i,
];

/**
 * Returns the signal that promoted a message, or null when it is not a
 * candidate. Urgency/deadline words alone are deliberately not enough: many
 * automated notices contain them but do not need a reply.
 */
export function getNeedsResponseReason(message: Message): NeedsResponseReason | null {
  // Skip already read emails (user probably handled it)
  if (message.flags.seen) return null;

  // Skip messages from no-reply addresses
  const fromAddress = message.from.address.toLowerCase();
  if (INFORMATIONAL_PATTERNS.some(p => p.test(fromAddress))) {
    return null;
  }

  const subject = message.subject || '';
  const text = message.text || '';
  const combined = `${subject} ${text}`.slice(0, 2000);

  // Skip if looks like informational
  if (INFORMATIONAL_PATTERNS.some(p => p.test(combined))) {
    return null;
  }

  if (WAITING_PATTERN.test(combined)) return 'waiting';
  if (DIRECT_REQUEST_PATTERNS.some(p => p.test(combined))) return 'request';
  if (QUESTION_PATTERN.test(combined)) return 'question';

  return null;
}

export function useNeedsResponse(
  messages: Message[] | undefined,
  limit = 5
): UseNeedsResponseResult {
  const result = useMemo(() => {
    if (!messages || messages.length === 0) {
      return { messages: [], count: 0, reasons: new Map() };
    }

    const reasons = new Map<string, NeedsResponseReason>();
    const filtered = messages.filter((message) => {
      const reason = getNeedsResponseReason(message);
      if (reason) reasons.set(message._id, reason);
      return reason !== null;
    });

    // Sort by date descending (most recent first)
    const sorted = [...filtered].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return {
      messages: sorted.slice(0, limit),
      count: sorted.length,
      reasons,
    };
  }, [messages, limit]);

  return result;
}
