import { renderHook } from '@testing-library/react';
import type { Message } from '@/services/emailApi';
import {
  getNeedsResponseReason,
  useNeedsResponse,
} from '@/hooks/queries/useNeedsResponse';

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    _id: 'message-1',
    userId: 'user-1',
    mailboxId: 'inbox-1',
    messageId: 'message-id-1',
    from: { address: 'sender@example.com' },
    to: [{ address: 'me@example.com' }],
    subject: 'Hello',
    text: 'A normal update.',
    attachments: [],
    flags: { seen: false, starred: false, pinned: false },
    labels: [],
    card: null,
    date: '2026-08-15T10:00:00.000Z',
    receivedAt: '2026-08-15T10:00:00.000Z',
    ...overrides,
  };
}

describe('needs-response triage', () => {
  it('returns an explainable reason for a direct request', () => {
    expect(
      getNeedsResponseReason(
        makeMessage({ text: 'Could you review this proposal and let me know?' }),
      ),
    ).toBe('request');
  });

  it('does not promote read or informational messages', () => {
    expect(getNeedsResponseReason(makeMessage({ flags: { seen: true } }))).toBeNull();
    expect(
      getNeedsResponseReason(
        makeMessage({
          from: { address: 'no-reply@example.com' },
          text: 'FYI, did you know this newsletter has a question?',
        }),
      ),
    ).toBeNull();
  });

  it('keeps the reason map aligned with sorted, limited candidates', () => {
    const older = makeMessage({ _id: 'older', date: '2026-08-14T10:00:00.000Z', text: 'What do you think?' });
    const newer = makeMessage({ _id: 'newer', date: '2026-08-15T11:00:00.000Z', text: 'Please confirm the time.' });

    const { result } = renderHook(() => useNeedsResponse([older, newer], 1));

    expect(result.current.count).toBe(2);
    expect(result.current.messages.map((message) => message._id)).toEqual(['newer']);
    expect(result.current.reasons.get('newer')).toBe('request');
  });
});
