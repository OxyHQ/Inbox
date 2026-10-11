/**
 * `useCommitmentDetection` — promises and deadlines found in a sent message.
 *
 * The memo was keyed by the message's id and text only, while the deadlines
 * are counted from its sent date: a date that changed under the same id and
 * text kept the old deadlines.
 */

import { renderHook } from '@testing-library/react';

import { useCommitmentDetection } from '@/hooks/queries/useCommitmentDetection';
import { MessageSchema, type Message } from '@/schemas/emailSchemas';
import { wireMessage } from '../fixtures/wire';

function sent(date: string): Message {
  return MessageSchema.parse(
    wireMessage({ _id: 'sent-1', id: 'sent-1', text: "I'll send the deck tomorrow", date }),
  );
}

it('finds the promise and dates the deadline from when the message was sent', () => {
  const { result } = renderHook(() => useCommitmentDetection(sent('2026-09-01T10:00:00.000Z')));

  expect(result.current.map((c) => c.type)).toEqual(['promise']);
  expect(result.current[0].text).toBe("I'll send");
  expect(result.current[0].deadlineText).toBe('tomorrow');
  expect(result.current[0].deadline?.getDate()).toBe(
    new Date('2026-09-02T10:00:00.000Z').getDate(),
  );
});

it('finds the same commitments every time a message is scanned', () => {
  const message = sent('2026-09-01T10:00:00.000Z');
  const first = renderHook(() => useCommitmentDetection(message)).result.current;
  const second = renderHook(() => useCommitmentDetection(message)).result.current;

  expect(second).toEqual(first);
  expect(second).toHaveLength(1);
});

it('re-dates the deadlines when the sent date changes', () => {
  const { result, rerender } = renderHook(({ message }) => useCommitmentDetection(message), {
    initialProps: { message: sent('2026-09-01T10:00:00.000Z') },
  });
  const before = result.current[0].deadline?.getTime();

  rerender({ message: sent('2026-09-05T10:00:00.000Z') });

  expect(result.current[0].deadline?.getTime()).not.toBe(before);
});

it('finds nothing without a message', () => {
  const { result } = renderHook(() => useCommitmentDetection(null));
  expect(result.current).toEqual([]);
});
