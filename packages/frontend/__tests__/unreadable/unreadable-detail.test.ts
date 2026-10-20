/**
 * Opening an unreadable row. The list shows a message that fails the schema
 * as an unreadable row; opening it read the message strictly, which threw, and
 * the reader showed a load error whose retry parsed the same row again — an
 * error screen that never cleared. The read now says WHICH message could not
 * be read, the reader shows the unreadable entry with its source download, and
 * the query does not spend its retries on a row that will fail the same way.
 */

jest.mock('@/utils/inboxTelemetry', () => ({ recordInboxMetric: jest.fn() }));

const mockUseQuery = jest.fn();
jest.mock('@tanstack/react-query', () => ({ useQuery: (config: unknown) => mockUseQuery(config) }));
jest.mock('@/hooks/useEmail', () => ({
  useEmailStore: (selector: (s: unknown) => unknown) => selector({ _api: {} }),
}));

import { renderHook } from '@testing-library/react';
import { __setOxyState } from '@oxy.so/services/ui/client';

import { useMessage } from '@/hooks/queries/useMessage';
import { createEmailApi, UnreadableMessageError } from '@/services/emailApi';
import { wireMessage } from '../fixtures/wire';

const broken = { ...wireMessage({ _id: 'broken', id: 'broken', subject: 'Invoice' }), from: null };

it('reads an unreadable message as the row the list shows for it', async () => {
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  const api = createEmailApi({ get: jest.fn().mockResolvedValue(broken) } as never);

  const failure = await api.getMessage('broken').catch((error: unknown) => error);

  expect(failure).toBeInstanceOf(UnreadableMessageError);
  expect((failure as UnreadableMessageError).unreadable).toEqual({
    kind: 'unreadable',
    _id: 'broken',
    from: null,
    subject: 'Invoice',
    receivedAt: broken.receivedAt,
  });
  consoleError.mockRestore();
});

it('does not retry a message that cannot be read, and retries anything else', () => {
  __setOxyState({ user: { id: 'user-1' } });
  renderHook(() => useMessage('broken'));
  const { retry } = mockUseQuery.mock.calls[0][0] as {
    retry: (failureCount: number, error: unknown) => boolean;
  };

  expect(
    retry(
      0,
      new UnreadableMessageError(
        { kind: 'unreadable', _id: 'broken', from: null, subject: null, receivedAt: null },
        [],
      ),
    ),
  ).toBe(false);
  expect(retry(0, new Error('offline'))).toBe(true);
  expect(retry(2, new Error('offline'))).toBe(false);
});
