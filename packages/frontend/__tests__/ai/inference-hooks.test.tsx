import React, { type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import {
  __resetOxyState,
  __setOxyState,
  makeMockOxyServices,
} from '@/__mocks__/oxyhq-services';
import { useAiCompose } from '@/hooks/mutations/useAiCompose';
import { useDailyBrief } from '@/hooks/queries/useDailyBrief';
import {
  inboxLocalDayWindow,
  runInboxCompose,
  streamInboxDailyBrief,
  streamInboxDraft,
} from '@/services/inboxInferenceApi';

jest.mock('@/services/inboxInferenceApi', () => ({
  inboxLocalDayWindow: jest.fn(),
  runInboxCompose: jest.fn(),
  streamInboxDailyBrief: jest.fn(),
  streamInboxDraft: jest.fn(),
}));

const mockInboxLocalDayWindow = jest.mocked(inboxLocalDayWindow);
const mockRunInboxCompose = jest.mocked(runInboxCompose);
const mockStreamInboxDailyBrief = jest.mocked(streamInboxDailyBrief);
const mockStreamInboxDraft = jest.mocked(streamInboxDraft);

function abortError(): Error {
  const error = new Error('aborted');
  error.name = 'AbortError';
  return error;
}

function wrapper(queryClient: QueryClient): ({ children }: { children: ReactNode }) => React.JSX.Element {
  return function QueryWrapper({ children }: { children: ReactNode }): React.JSX.Element {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('Inbox inference hooks', () => {
  beforeEach(() => {
    __resetOxyState();
    mockInboxLocalDayWindow.mockReset().mockReturnValue({
      day: '2026-09-03',
      startAt: '2026-09-02T21:00:00.000Z',
      endAt: '2026-09-03T21:00:00.000Z',
    });
    mockRunInboxCompose.mockReset();
    mockStreamInboxDailyBrief.mockReset();
    mockStreamInboxDraft.mockReset();
    Object.defineProperty(globalThis, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(Date.now()), 0),
    });
    Object.defineProperty(globalThis, 'cancelAnimationFrame', {
      configurable: true,
      value: (handle: number) => window.clearTimeout(handle),
    });
  });

  it('aborts compose streaming on unmount and stops chunk callbacks', async () => {
    const oxyServices = {
      ...makeMockOxyServices(),
      httpService: {},
    };
    __setOxyState({
      user: { id: 'user-1', username: 'nate' },
      isAuthenticated: true,
      canUsePrivateApi: true,
      oxyServices,
    });

    let observedSignal: AbortSignal | undefined;
    mockStreamInboxDraft.mockImplementation(async function* (_http, _request, signal) {
      observedSignal = signal;
      await new Promise<void>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(abortError()), { once: true });
      });
      yield 'unreachable';
    });

    const queryClient = new QueryClient();
    const onChunk = jest.fn();
    const rendered = renderHook(() => useAiCompose(), { wrapper: wrapper(queryClient) });
    let outcome: Promise<unknown> = Promise.resolve();
    act(() => {
      outcome = rendered.result.current.streamDraft('Write a note', 'friendly', onChunk)
        .catch((error: unknown) => error);
    });

    await waitFor(() => expect(observedSignal).toBeDefined());
    act(() => rendered.unmount());

    expect(observedSignal?.aborted).toBe(true);
    await expect(outcome).resolves.toMatchObject({ name: 'AbortError' });
    expect(onChunk).not.toHaveBeenCalled();
    queryClient.clear();
  });

  it('retries an opened Daily Brief after its collapsed stream finishes aborting', async () => {
    const oxyServices = {
      ...makeMockOxyServices(),
      httpService: {},
    };
    __setOxyState({
      user: { id: 'user-1', username: 'nate' },
      isAuthenticated: true,
      canUsePrivateApi: true,
      oxyServices,
    });

    let firstSignal: AbortSignal | undefined;
    let releaseFirst = (): void => undefined;
    mockStreamInboxDailyBrief
      .mockImplementationOnce(async function* (_http, _window, signal) {
        firstSignal = signal;
        await new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });
        if (signal?.aborted) throw abortError();
        yield 'unreachable';
      })
      .mockImplementationOnce(async function* () {
        yield 'Ready';
      });

    const queryClient = new QueryClient();
    const rendered = renderHook(
      ({ enabled }: { enabled: boolean }) => useDailyBrief({ enabled, autoGenerate: true }),
      { initialProps: { enabled: true }, wrapper: wrapper(queryClient) },
    );
    await waitFor(() => expect(firstSignal).toBeDefined());

    act(() => rendered.rerender({ enabled: false }));
    await waitFor(() => expect(firstSignal?.aborted).toBe(true));
    act(() => rendered.rerender({ enabled: true }));
    expect(mockStreamInboxDailyBrief).toHaveBeenCalledTimes(1);

    act(() => releaseFirst());
    await waitFor(() => expect(mockStreamInboxDailyBrief).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(rendered.result.current.briefText).toBe('Ready'));

    rendered.unmount();
    queryClient.clear();
  });
});
