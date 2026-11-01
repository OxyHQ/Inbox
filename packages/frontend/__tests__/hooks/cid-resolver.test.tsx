/**
 * `useCidResolver` — inline images (`cid:` references) resolved to signed File
 * Manager URLs, per displayed message.
 *
 * The maps used to be cleared by an effect when the displayed message changed,
 * so the new message rendered once with the previous message's maps and then
 * again without them. These pin that the first render after a change has none,
 * and that a lookup finishing after the user moved on is dropped.
 */

import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook as render, waitFor } from '@testing-library/react';
import type { OxyServices } from '@oxy.so/core';
import type { ReactNode } from 'react';

const mockRuntime = {};
jest.mock('@/hooks/queries/useObservedInferenceOwner', () => ({
  useObservedInferenceOwner: () => ({
    binding: 'test',
    subject: 'alice',
    sessionId: 'session-a',
    revision: 1,
    epoch: 1,
    knownSubject: 'alice',
    authenticated: true,
    ready: true,
    isCurrent: () => true,
    http: undefined,
    runtime: mockRuntime,
  }),
}));

import { useCidResolver } from '@/hooks/useCidResolver';
import { MessageSchema, type Message } from '@/schemas/emailSchemas';
import { wireMessage } from '../fixtures/wire';

const inlineImage = {
  fileId: 'file-logo',
  name: 'logo.png',
  contentType: 'image/png',
  size: 1200,
  contentId: '<logo@example>',
  isInline: true,
};

function messageWithImage(id: string, fileId = inlineImage.fileId): Message {
  return MessageSchema.parse(
    wireMessage({
      _id: id,
      id,
      html: '<p>Hi</p><img src="cid:logo@example">',
      attachments: [{ ...inlineImage, fileId }],
    }),
  );
}

/** Each test with its own query cache: the signed URLs are cached in it. */
const renderHook: typeof render = (callback, options) => {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(callback, { ...options, wrapper } as typeof options);
};

function services(url: (fileId: string) => Promise<string>): OxyServices {
  return { assets: { url: jest.fn(url) } } as unknown as OxyServices;
}

async function settle() {
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

const thread = [messageWithImage('m1'), messageWithImage('m2')];

it('replaces cid: references with the signed URLs', async () => {
  const oxy = services(async (fileId) => `https://files.example/${fileId}`);
  const { result } = renderHook(() => useCidResolver(thread, oxy, 'm1'));
  await settle();

  expect(result.current.m1).toBe('<p>Hi</p><img src="https://files.example/file-logo">');
  expect(result.current.m2).toBe('<p>Hi</p><img src="https://files.example/file-logo">');
});

it('does not render the next message with the previous message’s maps', async () => {
  const oxy = services(async (fileId) => `https://files.example/${fileId}`);
  const renders: Record<string, string>[] = [];
  const { rerender } = renderHook(
    ({ resetKey }) => {
      const resolved = useCidResolver(thread, oxy, resetKey);
      renders.push(resolved);
      return resolved;
    },
    { initialProps: { resetKey: 'm1' } },
  );
  await settle();
  expect(renders.at(-1)?.m1).toContain('https://files.example/file-logo');

  const before = renders.length;
  rerender({ resetKey: 'm2' });

  // The first render for the new message: nothing resolved for it yet.
  expect(renders[before].m1).toContain('cid:logo@example');
  expect(renders[before].m2).toContain('cid:logo@example');

  await settle();
  expect(renders.at(-1)?.m2).toContain('https://files.example/file-logo');
});

it('drops a lookup that finishes after the displayed message changed', async () => {
  const lookups: { fileId: string; resolve: (url: string) => void }[] = [];
  const oxy = services(
    (fileId) =>
      new Promise<string>((resolve) => {
        lookups.push({ fileId, resolve });
      }),
  );
  const first = [messageWithImage('a1', 'file-a')];
  const second = [messageWithImage('b1', 'file-b')];
  const { result, rerender } = renderHook(
    ({ messages, resetKey }) => useCidResolver(messages, oxy, resetKey),
    { initialProps: { messages: first, resetKey: 'a1' } },
  );
  await settle();
  expect(lookups).toHaveLength(1);

  rerender({ messages: second, resetKey: 'b1' });
  await settle();
  expect(lookups).toHaveLength(2);

  // The first message's lookup lands late, then the second one's.
  await act(async () => {
    lookups[0].resolve('https://files.example/stale');
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
  expect(result.current.b1).toContain('cid:logo@example');
  expect(result.current.a1).toBeUndefined();

  await act(async () => {
    lookups[1].resolve('https://files.example/fresh');
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
  expect(result.current.b1).toBe('<p>Hi</p><img src="https://files.example/fresh">');
});

it('asks for an image URL once while it is fresh, not per message or per open', async () => {
  const oxy = services(async (fileId) => `https://files.example/${fileId}`);
  const { rerender } = renderHook(({ resetKey }) => useCidResolver(thread, oxy, resetKey), {
    initialProps: { resetKey: 'm1' },
  });
  await settle();
  rerender({ resetKey: 'm2' });
  await settle();

  // Two messages, two opens, one image: one request.
  expect(oxy.assets.url).toHaveBeenCalledTimes(1);
});

it('reuses an in-flight lookup for the same image after switching messages', async () => {
  let finish: (url: string) => void = () => {};
  const oxy = services(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const first = [messageWithImage('a1')];
  const second = [messageWithImage('b1')];
  const { result, rerender } = renderHook(
    ({ messages, resetKey }) => useCidResolver(messages, oxy, resetKey),
    { initialProps: { messages: first, resetKey: 'a1' } },
  );
  await settle();
  rerender({ messages: second, resetKey: 'b1' });
  await settle();
  await act(async () => {
    finish('https://files.example/image');
  });
  await settle();
  expect(result.current.b1).toContain('https://files.example/image');
  expect(result.current.a1).toBeUndefined();
  expect(oxy.assets.url).toHaveBeenCalledTimes(1);
});

it('reuses the previously resolved URL on an offline remount', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { networkMode: 'offlineFirst', retry: false } },
  });
  const oxy = services(async (fileId) => {
    if (!onlineManager.isOnline()) throw new Error('offline');
    return `https://files.example/${fileId}`;
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const first = render(() => useCidResolver(thread, oxy, 'm1'), { wrapper });
  await waitFor(() => expect(first.result.current.m1).toContain('https://files.example/file-logo'));
  first.unmount();
  onlineManager.setOnline(false);
  const second = render(() => useCidResolver(thread, oxy, 'm1'), { wrapper });
  try {
    await waitFor(() =>
      expect(second.result.current.m1).toContain('https://files.example/file-logo'),
    );
  } finally {
    second.unmount();
    client.clear();
    onlineManager.setOnline(true);
  }
});

it('does not renew a cached signed URL merely by reading it', async () => {
  let now = 1_000_000;
  const clock = jest.spyOn(Date, 'now').mockImplementation(() => now);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const oxy = services(async (fileId) => `https://files.example/${fileId}`);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = render(({ resetKey }) => useCidResolver(thread, oxy, resetKey), {
    wrapper,
    initialProps: { resetKey: 'm1' },
  });
  try {
    await waitFor(() =>
      expect(hook.result.current.m1).toContain('https://files.example/file-logo'),
    );
    const cached = client
      .getQueryCache()
      .getAll()
      .find((q) => q.queryKey.includes('cid-scoped-v1') && !q.queryKey.includes('pending'));
    expect(cached?.state.dataUpdatedAt).toBe(now);
    now += 30 * 60_000;
    hook.rerender({ resetKey: 'm2' });
    await settle();
    expect(cached?.state.dataUpdatedAt).toBe(1_000_000);
    expect(oxy.assets.url).toHaveBeenCalledTimes(1);
    now += 16 * 60_000;
    hook.rerender({ resetKey: 'm1' });
    await waitFor(() => expect(oxy.assets.url).toHaveBeenCalledTimes(2));
  } finally {
    hook.unmount();
    client.clear();
    clock.mockRestore();
  }
});

it('fetches again when the confirmed URL cache is invalidated', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const oxy = services(async (fileId) => `https://files.example/${fileId}`);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = render(({ resetKey }) => useCidResolver(thread, oxy, resetKey), {
    wrapper,
    initialProps: { resetKey: 'm1' },
  });
  await waitFor(() => expect(hook.result.current.m1).toContain('https://files.example/file-logo'));
  const cached = client
    .getQueryCache()
    .getAll()
    .find((q) => q.queryKey.includes('cid-scoped-v1') && !q.queryKey.includes('pending'));
  expect(cached).toBeDefined();
  await client.invalidateQueries({ queryKey: cached?.queryKey, exact: true, refetchType: 'none' });
  hook.rerender({ resetKey: 'm2' });
  await waitFor(() => expect(oxy.assets.url).toHaveBeenCalledTimes(2));
  hook.unmount();
  client.clear();
});

it('retries an initially unavailable image once connectivity returns', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { networkMode: 'offlineFirst', retry: false } },
  });
  const oxy = services(async (fileId) => {
    if (!onlineManager.isOnline()) throw new Error('offline');
    return `https://files.example/${fileId}`;
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  onlineManager.setOnline(false);
  const oneMessage = [thread[0]];
  const first = render(() => useCidResolver(oneMessage, oxy, 'm1'), { wrapper });
  try {
    await waitFor(() => expect(oxy.assets.url).toHaveBeenCalledTimes(1));
    await settle();
    expect(first.result.current.m1).toContain('cid:logo@example');
    act(() => onlineManager.setOnline(true));
    await waitFor(() =>
      expect(first.result.current.m1).toContain('https://files.example/file-logo'),
    );
    expect(oxy.assets.url).toHaveBeenCalledTimes(2);
  } finally {
    first.unmount();
    client.clear();
    onlineManager.setOnline(true);
  }
});

it('retries failed images at most once per reconnect, not in a render loop', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { networkMode: 'offlineFirst', retry: false } },
  });
  const oxy = services(async () => {
    throw new Error('unavailable');
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  onlineManager.setOnline(false);
  const hook = render(() => useCidResolver([thread[0]], oxy, 'm1'), { wrapper });
  try {
    await waitFor(() => expect(oxy.assets.url).toHaveBeenCalledTimes(1));
    await settle();
    expect(oxy.assets.url).toHaveBeenCalledTimes(1);
    act(() => onlineManager.setOnline(true));
    await waitFor(() => expect(oxy.assets.url).toHaveBeenCalledTimes(2));
    await settle();
    expect(oxy.assets.url).toHaveBeenCalledTimes(2);
    act(() => onlineManager.setOnline(false));
    act(() => onlineManager.setOnline(true));
    await waitFor(() => expect(oxy.assets.url).toHaveBeenCalledTimes(3));
    await settle();
    expect(oxy.assets.url).toHaveBeenCalledTimes(3);
  } finally {
    hook.unmount();
    client.clear();
    onlineManager.setOnline(true);
  }
});

it('retains successful inline images and retries only failures on reconnect', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { networkMode: 'offlineFirst', retry: false } },
  });
  const urls = jest.fn(async (fileId: string) => {
    if (fileId === 'file-b' && !onlineManager.isOnline()) throw new Error('offline');
    return `https://files.example/${fileId}`;
  });
  const oxy = services(urls);
  const partial = MessageSchema.parse(
    wireMessage({
      _id: 'partial',
      id: 'partial',
      html: '<img src="cid:one"><img src="cid:two">',
      attachments: [
        { ...inlineImage, fileId: 'file-a', contentId: '<one>' },
        { ...inlineImage, fileId: 'file-b', contentId: '<two>' },
      ],
    }),
  );
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  onlineManager.setOnline(false);
  const hook = render(() => useCidResolver([partial], oxy, 'partial'), { wrapper });
  try {
    await waitFor(() =>
      expect(hook.result.current.partial).toContain('https://files.example/file-a'),
    );
    expect(hook.result.current.partial).toContain('cid:two');
    act(() => onlineManager.setOnline(true));
    await waitFor(() =>
      expect(hook.result.current.partial).toContain('https://files.example/file-b'),
    );
    expect(hook.result.current.partial).toContain('https://files.example/file-a');
    expect(urls.mock.calls.filter(([fileId]) => fileId === 'file-a')).toHaveLength(1);
    expect(urls.mock.calls.filter(([fileId]) => fileId === 'file-b')).toHaveLength(2);
  } finally {
    hook.unmount();
    client.clear();
    onlineManager.setOnline(true);
  }
});

it('retries an offline attempt that fails after connectivity has returned', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { networkMode: 'offlineFirst', retry: false } },
  });
  let fail: (error: Error) => void = () => {};
  let attempts = 0;
  const oxy = services(async (fileId) => {
    if (++attempts === 1)
      return new Promise<string>((_resolve, reject) => {
        fail = reject;
      });
    return `https://files.example/${fileId}`;
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  onlineManager.setOnline(false);
  const hook = render(() => useCidResolver([thread[0]], oxy, 'm1'), { wrapper });
  try {
    await waitFor(() => expect(attempts).toBe(1));
    act(() => onlineManager.setOnline(true));
    await act(async () => {
      fail(new Error('offline'));
    });
    await waitFor(() =>
      expect(hook.result.current.m1).toContain('https://files.example/file-logo'),
    );
    expect(attempts).toBe(2);
  } finally {
    hook.unmount();
    client.clear();
    onlineManager.setOnline(true);
  }
});
