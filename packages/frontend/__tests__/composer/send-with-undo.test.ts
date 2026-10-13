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
  dismiss: jest.fn(),
});

jest.mock('@oxy.so/bloom', () => ({ toast }));

const invalidateQueries = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: () => ({ invalidateQueries }),
}));

const sendMessage = jest.fn();
jest.mock('@/hooks/useEmail', () => ({
  useEmailStore: (selector: (s: unknown) => unknown) => selector({ _api: { sendMessage } }),
}));

jest.mock('@oxy.so/services', () => ({ useOxy: () => ({ user: { id: 'u1' } }) }));

// Toasts are translated; the keys are what these tests read.
const t = (key: string) => key;
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t }) }));

const recordInboxMetric = jest.fn();
jest.mock('@/utils/inboxTelemetry', () => ({ recordInboxMetric }));

import { renderHook, act } from '@testing-library/react';
import { useSendMessageWithUndo } from '@/hooks/mutations/useMessageMutations';
import { keyReusedError } from '../fixtures/sendKeyReused';

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
  it('reports success and lets the caller discard the recovery snapshot', async () => {
    sendMessage.mockResolvedValue({
      id: 'row-1',
      messageId: '<a@oxy.so>',
      delivery: { state: 'sending' },
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

describe('a delivery that already failed once', () => {
  /**
   * A repeat of the same key after the relay refused it answers with the
   * message's own delivery. That is still an accepted send: the server holds
   * the message, and the failure is shown on it — not here, by keeping a
   * composer open over a message that is already in Sent.
   */
  it('still closes the composer; the message carries the failure', async () => {
    sendMessage.mockResolvedValue({
      id: 'row-1',
      messageId: '<a@oxy.so>',
      delivery: { state: 'retrying' },
      message: 'Message accepted for delivery',
    });
    const onSuccess = jest.fn();

    const { result } = renderHook(() => useSendMessageWithUndo());
    await act(async () => {
      void result.current.sendWithUndo(recipients, { onSuccess });
    });
    await elapseUndoWindow();

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(toast.warning).not.toHaveBeenCalled();
  });
});

describe('undo', () => {
  it('cancels within the window and never reaches the network', async () => {
    sendMessage.mockResolvedValue({
      messageId: '<a@oxy.so>',
      message: 'Message accepted for delivery',
    });
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

describe('after the window', () => {
  /**
   * The toast pauses while hovered or while the page is hidden; the send's
   * timer does not. Undo used to stay pressable after the message had gone —
   * it said "cancelled" and reopened the composer for a message that left.
   */
  it('dismisses the toast when the send fires, and Undo then does nothing', async () => {
    sendMessage.mockResolvedValue({
      messageId: '<a@oxy.so>',
      message: 'Message accepted for delivery',
    });
    const onCancel = jest.fn();
    toast.mockReturnValueOnce('undo-toast');

    const { result } = renderHook(() => useSendMessageWithUndo());
    let pending: { cancel: () => boolean } | undefined;
    await act(async () => {
      pending = result.current.sendWithUndo(recipients, { onCancel });
    });
    await elapseUndoWindow();

    expect(toast.dismiss).toHaveBeenCalledWith('undo-toast');
    const options = toast.mock.calls[0][1] as { action: { onClick: () => void } };
    act(() => {
      options.action.onClick();
    });
    expect(onCancel).not.toHaveBeenCalled();
    expect(pending?.cancel()).toBe(false);
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('cancel() inside the window stops the send, as Discard does', async () => {
    const onCancel = jest.fn();
    const { result } = renderHook(() => useSendMessageWithUndo());
    let pending: { cancel: () => boolean } | undefined;
    await act(async () => {
      pending = result.current.sendWithUndo(recipients, { onCancel });
    });
    let cancelled = false;
    act(() => {
      cancelled = pending?.cancel() ?? false;
    });
    await elapseUndoWindow();

    expect(cancelled).toBe(true);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(sendMessage).not.toHaveBeenCalled();
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

describe('a key that already sent a different message', () => {
  /**
   * A compose restored after a crash resumes its key, and its body renders
   * differently, so the API refuses it (OxyHQ/oxy#1676). The message is in
   * Sent: that is not a send failure, and the API's "send this one with a new
   * key" must never reach the user — following it sends the message twice.
   */
  it('is reported as already sent, not as a failure', async () => {
    sendMessage.mockRejectedValue(keyReusedError());
    const onSuccess = jest.fn();
    const onError = jest.fn();
    const onAlreadySent = jest.fn();

    const { result } = renderHook(() => useSendMessageWithUndo());
    await act(async () => {
      void result.current.sendWithUndo(recipients, { onSuccess, onError, onAlreadySent });
    });
    await elapseUndoWindow();

    expect(onAlreadySent).toHaveBeenCalledWith({
      id: 'sent-row-1',
      messageId: '<inbox-send-1@oxy.so>',
      deliveryState: 'sent',
      scheduledAt: null,
    });
    expect(onError).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(recordInboxMetric).toHaveBeenCalledWith('composer_send_already_sent');
    expect(recordInboxMetric).not.toHaveBeenCalledWith('composer_send_failed');
    // Sent holds the message: the lists showing it are stale.
    expect(invalidateQueries).toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledTimes(1);
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
    sendMessage.mockResolvedValueOnce({
      messageId: '<a@oxy.so>',
      message: 'Message accepted for delivery',
    });

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
