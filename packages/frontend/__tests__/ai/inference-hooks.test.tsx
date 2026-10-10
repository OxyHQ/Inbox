import React, { type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { __resetOxyState, __setOxyState, makeMockOxyServices } from '@/__mocks__/oxyhq-services';
import { useAiCompose } from '@/hooks/mutations/useAiCompose';
import { useDailyBrief } from '@/hooks/queries/useDailyBrief';
import {
  inboxLocalDayWindow,
  runInboxCompose,
  fetchInboxDailyBrief,
  streamInboxDraft,
} from '@/services/inboxInferenceApi';

const mockToast = Object.assign(jest.fn(), { error: jest.fn() });
jest.mock('@oxy.so/bloom', () => ({
  get toast() {
    return mockToast;
  },
}));
jest.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  useLocale: () => ({ locale: 'es' }),
}));

jest.mock('@/services/inboxInferenceApi', () => ({
  inboxLocalDayWindow: jest.fn(),
  runInboxCompose: jest.fn(),
  fetchInboxDailyBrief: jest.fn(),
  streamInboxDraft: jest.fn(),
}));

const mockInboxLocalDayWindow = jest.mocked(inboxLocalDayWindow);
const mockRunInboxCompose = jest.mocked(runInboxCompose);
const mockFetchInboxDailyBrief = jest.mocked(fetchInboxDailyBrief);
const mockStreamInboxDraft = jest.mocked(streamInboxDraft);

function abortError(): Error {
  const error = new Error('aborted');
  error.name = 'AbortError';
  return error;
}

function wrapper(
  queryClient: QueryClient,
): ({ children }: { children: ReactNode }) => React.JSX.Element {
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
    mockFetchInboxDailyBrief.mockReset();
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

  it('says when a rewrite fails, rather than doing nothing visible', async () => {
    __setOxyState({
      user: { id: 'user-1', username: 'nate' },
      isAuthenticated: true,
      canUsePrivateApi: true,
      oxyServices: { ...makeMockOxyServices(), httpService: {} },
    });
    mockRunInboxCompose.mockRejectedValue(new Error('service_unavailable'));
    mockToast.error.mockClear();

    const queryClient = new QueryClient();
    const rendered = renderHook(() => useAiCompose(), { wrapper: wrapper(queryClient) });
    await act(async () => {
      await rendered.result.current.polish('hello').catch(() => undefined);
    });

    expect(mockToast.error).toHaveBeenCalledWith('ai.toast.failed');
    queryClient.clear();
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
      outcome = rendered.result.current
        .streamDraft('Write a note', 'friendly', onChunk)
        .catch((error: unknown) => error);
    });

    await waitFor(() => expect(observedSignal).toBeDefined());
    act(() => rendered.unmount());

    expect(observedSignal?.aborted).toBe(true);
    await expect(outcome).resolves.toMatchObject({ name: 'AbortError' });
    expect(onChunk).not.toHaveBeenCalled();
    queryClient.clear();
  });

  it('fetches the Daily Brief only while open, in the UI language, and marks opened rows read', async () => {
    const oxyServices = makeMockOxyServices();
    __setOxyState({
      user: { id: 'user-1', username: 'nate' },
      isAuthenticated: true,
      canUsePrivateApi: true,
      oxyServices,
    });
    mockFetchInboxDailyBrief.mockResolvedValue({
      schemaVersion: 1,
      requestId: 'req_brief',
      summary: 'Ana needs the numbers by Friday.',
      counts: { received: 1, unread: 1, starred: 0, earlierUnread: 0 },
      items: [
        {
          messageId: 'msg_ana',
          section: 'needs_you',
          note: 'Wants the quarterly numbers by Friday.',
          from: { name: 'Ana', address: 'ana@example.com' },
          subject: 'Quarterly numbers',
          receivedAt: '2026-09-03T08:00:00.000Z',
          unread: true,
          hasAttachments: false,
        },
      ],
    });

    const queryClient = new QueryClient();
    const rendered = renderHook(({ enabled }: { enabled: boolean }) => useDailyBrief({ enabled }), {
      initialProps: { enabled: false },
      wrapper: wrapper(queryClient),
    });
    expect(mockFetchInboxDailyBrief).not.toHaveBeenCalled();

    rendered.rerender({ enabled: true });
    await waitFor(() =>
      expect(rendered.result.current.brief?.summary).toBe('Ana needs the numbers by Friday.'),
    );
    expect(mockFetchInboxDailyBrief).toHaveBeenCalledWith(
      oxyServices.http,
      { startAt: '2026-09-02T21:00:00.000Z', endAt: '2026-09-03T21:00:00.000Z', locale: 'es' },
      expect.any(AbortSignal),
    );

    act(() => rendered.result.current.markOpened('msg_ana'));
    await waitFor(() => expect(rendered.result.current.brief?.items[0]?.unread).toBe(false));

    // Closing and reopening the brief within the half hour reuses it.
    rendered.rerender({ enabled: false });
    rendered.rerender({ enabled: true });
    expect(mockFetchInboxDailyBrief).toHaveBeenCalledTimes(1);

    rendered.unmount();
    queryClient.clear();
  });
});
