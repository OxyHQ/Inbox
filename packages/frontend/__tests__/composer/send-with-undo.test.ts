/**
 * `useSendMessageWithUndo` — the five-second window, and the distinction that
 * hid a total outbound outage.
 *
 * `POST /email/messages` answers 202 in two very different situations. Either
 * the relay took the message, or the relay refused it for a reason the server
 * judged transient and parked it in the durable outbox. The second one is
 * `{ queued: true }`, and it used to be treated as success: an info toast, the
 * composer closing, and — the part that loses work — the local crash-recovery
 * snapshot deleted. With the relay misconfigured, every message in the system
 * took that branch and the app looked like it was working.
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
const recipients = { to: [{ address: 'someone@example.com' }] };

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

describe('delivered', () => {
  it('reports success and lets the caller discard the recovery snapshot', async () => {
    sendMessage.mockResolvedValue({ messageId: '<a@oxy.so>', queued: false, message: 'Message sent' });
    const onSuccess = jest.fn();
    const onQueued = jest.fn();

    const { result } = renderHook(() => useSendMessageWithUndo());
    await act(async () => {
      void result.current.sendWithUndo(recipients, { onSuccess, onQueued });
    });

    expect(sendMessage).not.toHaveBeenCalled(); // still inside the undo window
    await elapseUndoWindow();

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('Message sent');
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onQueued).not.toHaveBeenCalled();
    expect(recordInboxMetric).toHaveBeenCalledWith('composer_send_succeeded');
  });
});

describe('queued', () => {
  it('does NOT call onSuccess — the snapshot must survive', async () => {
    sendMessage.mockResolvedValue({ messageId: '<a@oxy.so>', queued: true, message: 'Message queued for delivery' });
    const onSuccess = jest.fn();
    const onQueued = jest.fn();

    const { result } = renderHook(() => useSendMessageWithUndo());
    await act(async () => {
      void result.current.sendWithUndo(recipients, { onSuccess, onQueued });
    });
    await elapseUndoWindow();

    // The regression, stated directly: `queued` is not `sent`.
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onQueued).toHaveBeenCalledTimes(1);
  });

  it('warns rather than reporting success, and says where to look', async () => {
    sendMessage.mockResolvedValue({ messageId: '<a@oxy.so>', queued: true, message: 'Message queued for delivery' });

    const { result } = renderHook(() => useSendMessageWithUndo());
    await act(async () => {
      void result.current.sendWithUndo(recipients);
    });
    await elapseUndoWindow();

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledWith(
      'Message queued for delivery',
      expect.objectContaining({ description: expect.stringContaining('Delivery queue') }),
    );
    expect(recordInboxMetric).toHaveBeenCalledWith('composer_send_queued', { queued: true });
  });
});

describe('undo', () => {
  it('cancels within the window and never reaches the network', async () => {
    sendMessage.mockResolvedValue({ messageId: '<a@oxy.so>', queued: false, message: 'Message sent' });
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
