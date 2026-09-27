/**
 * `useSendMessageWithUndo` — the five-second window, and what a 202 means.
 *
 * `POST /email/messages` files the message in Sent and answers before it talks
 * to any relay; delivery follows in the background and shows on the message.
 * So an accepted send IS the success the composer waits for — the server holds
 * the message, and a delivery that later fails is visible on it, with Retry.
 *
 * It used to be otherwise: the API relayed inside the request, a transient
 * relay failure answered `{ queued: true }`, and treating that as success hid
 * a total outbound outage. There is no such answer any more.
 */

const toast = Object.assign(jest.fn(), {
  success: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
});

jest.mock('@oxy.so/bloom', () => ({ toast }));

const invalidateQueries = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: () => ({ invalidateQueries }),
}));

const sendMessage = jest.fn();
jest.mock('@/hooks/useEmail', () => ({
  useEmailStore: (selector: (s: unknown) => unknown) =>
    selector({ _api: { sendMessage } }),
}));

jest.mock('@oxy.so/services', () => ({ useOxy: () => ({ user: { id: 'u1' } }) }));

const recordInboxMetric = jest.fn();
jest.mock('@/utils/inboxTelemetry', () => ({ recordInboxMetric }));

import { renderHook, act } from '@testing-library/react';
import { useSendMessageWithUndo } from '@/hooks/mutations/useMessageMutations';

const UNDO_MS = 5000;
const recipients = {
  to: [{ address: 'someone@example.com' }],
  subject: 'Hi',
  idempotencyKey: 'inbox-send-session-1',
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

/** Run the pending undo timer and let its async body settle. */
async function elapseUndoWindow() {
  await act(async () => {
    jest.advanceTimersByTime(UNDO_MS);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('accepted', () => {
  it('reports success once the API has filed the message, and lets the caller discard the snapshot', async () => {
    sendMessage.mockResolvedValue({
      id: 'row-1',
      messageId: '<a@oxy.so>',
      delivery: { state: 'sending', attempts: 0, maxAttempts: 5, error: null, errorCode: null, nextAttemptAt: null, updatedAt: '2026-09-27T08:00:00.000Z' },
      message: 'Message accepted for delivery',
    });
    const onSuccess = jest.fn();

    const { result } = renderHook(() => useSendMessageWithUndo());
    await act(async () => {
      void result.current.sendWithUndo(recipients, { onSuccess });
    });

    expect(sendMessage).not.toHaveBeenCalled(); // still inside the undo window
    await elapseUndoWindow();

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('Message accepted for delivery');
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(recordInboxMetric).toHaveBeenCalledWith('composer_send_succeeded');
  });
});

describe('undo', () => {
  it('cancels within the window and never reaches the network', async () => {
    sendMessage.mockResolvedValue({ messageId: '<a@oxy.so>', message: 'Message accepted for delivery' });
    const onSuccess = jest.fn();

    const { result } = renderHook(() => useSendMessageWithUndo());
    await act(async () => {
      void result.current.sendWithUndo(recipients, { onSuccess });
    });

    // The toast's action handler is the Undo button.
    const options = toast.mock.calls[0][1] as { action: { onClick: () => void } };
    act(() => {
      options.action.onClick();
    });
    await elapseUndoWindow();

    expect(sendMessage).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

describe('failure', () => {
  it('surfaces the error and calls onError', async () => {
    sendMessage.mockRejectedValue(new Error('Cannot send to this address: bounced'));
    const onSuccess = jest.fn();
    const onError = jest.fn();

    const { result } = renderHook(() => useSendMessageWithUndo());
    await act(async () => {
      void result.current.sendWithUndo(recipients, { onSuccess, onError });
    });
    await elapseUndoWindow();

    expect(toast.error).toHaveBeenCalledWith('Cannot send to this address: bounced');
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(recordInboxMetric).toHaveBeenCalledWith('composer_send_failed');
  });
});

describe('idempotency', () => {
  /**
   * One reply to an AWS support case left twice on 2026-09-27, with two
   * different `Message-Id`s: the key was minted inside every send call, so a
   * second press after a timed-out first one was a second message to the API.
   */
  it('sends the compose session key unchanged on every attempt', async () => {
    sendMessage.mockRejectedValueOnce(new Error('timeout'));
    sendMessage.mockResolvedValueOnce({ messageId: '<a@oxy.so>', message: 'Message accepted for delivery' });

    const { result } = renderHook(() => useSendMessageWithUndo());
    await act(async () => {
      void result.current.sendWithUndo(recipients);
    });
    await elapseUndoWindow();
    await act(async () => {
      void result.current.sendWithUndo(recipients);
    });
    await elapseUndoWindow();

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage.mock.calls.map(([request]) => request.idempotencyKey)).toEqual([
      'inbox-send-session-1',
      'inbox-send-session-1',
    ]);
  });
});
