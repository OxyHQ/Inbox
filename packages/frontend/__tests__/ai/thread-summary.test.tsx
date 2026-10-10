import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useThreadSummary } from '@/hooks/queries/useThreadSummary';
import { runInboxThreadSummary } from '@/services/inboxInferenceApi';
import type { Message } from '@/services/emailApi';

jest.mock('@oxy.so/services', () => ({
  useOxy: () => ({ user: { id: 'reader' }, oxyServices: { http: {} } }),
}));
jest.mock('@/services/inboxInferenceApi', () => ({ runInboxThreadSummary: jest.fn() }));
const summarize = jest.mocked(runInboxThreadSummary);
const messages = [{ _id: 'one' }] as Message[];

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const wrapper = ({ children }: React.PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

beforeEach(() => {
  summarize.mockReset();
  summarize.mockImplementation(async (_http, id) => ({
    summary: `Summary for ${id}`,
    keyPoints: [],
    actionItems: [],
  }));
});

it('summarizes a single-message thread on open and reuses its cached result on reopening', async () => {
  const { wrapper, client } = setup();
  const first = renderHook(() => useThreadSummary('one', messages), { wrapper });
  await waitFor(() => expect(first.result.current.summary).toBe('Summary for one'));
  expect(summarize).toHaveBeenCalledTimes(1);
  first.unmount();
  const reopened = renderHook(() => useThreadSummary('one', messages), { wrapper });
  expect(reopened.result.current.summary).toBe('Summary for one');
  expect(summarize).toHaveBeenCalledTimes(1);
  reopened.unmount();
  client.clear();
});

it('waits for readable messages and requests the selected thread when navigation changes', async () => {
  const { wrapper, client } = setup();
  const hook = renderHook(({ id, rows }) => useThreadSummary(id, rows), {
    wrapper,
    initialProps: { id: 'one', rows: [] as Message[] },
  });
  expect(summarize).not.toHaveBeenCalled();
  hook.rerender({ id: 'one', rows: messages });
  await waitFor(() => expect(hook.result.current.summary).toBe('Summary for one'));
  hook.rerender({ id: 'two', rows: [{ _id: 'two' }] as Message[] });
  expect(hook.result.current.summary).not.toBe('Summary for one');
  await waitFor(() => expect(hook.result.current.summary).toBe('Summary for two'));
  expect(summarize.mock.calls.map((call) => call[1])).toEqual(['one', 'two']);
  hook.unmount();
  client.clear();
});
