import { act, render, renderHook, waitFor } from '@testing-library/react';
import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { OxyServices } from '@oxy.so/core';
import { createContext, type ReactNode, startTransition, StrictMode, Suspense } from 'react';
import { createInboxQueryClient, INBOX_ACCOUNT_QUERIES } from '@/hooks/queries/queryClient';
import { MessageSchema } from '@/schemas/emailSchemas';
import { wireMessage } from '../fixtures/wire';

let mockOxy: OxyServices;
let mockRuntime: ReturnType<typeof import('@oxy.so/services/runtime').useOxyRuntime>;
const mockRuntimeContext = createContext<typeof mockRuntime | null>(null);
jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({ oxyServices: mockOxy, user: { id: 'alice' } }),
}));
jest.mock('@oxy.so/services/runtime', () => ({
  useOxyRuntime: () => require('react').useContext(mockRuntimeContext) ?? mockRuntime,
}));
import { useCidResolver } from '@/hooks/useCidResolver';
import { useAttachmentUrl } from '@/hooks/queries/useAttachmentUrl';
const message = MessageSchema.parse(
  wireMessage({
    _id: 'm1',
    id: 'm1',
    html: '<img src="cid:logo@example">',
    attachments: [
      {
        fileId: 'file-a',
        name: 'logo.png',
        contentType: 'image/png',
        size: 12,
        contentId: '<logo@example>',
        isInline: true,
      },
    ],
  }),
);
const messages = [message];
function token(session: string) {
  return `e30.${Buffer.from(JSON.stringify({ userId: 'alice', sessionId: session, exp: 2000000000 })).toString('base64url')}.fixture`;
}
async function setup() {
  mockOxy = new OxyServices({
    baseURL: 'https://api.test',
    enableRetry: false,
    enableCache: false,
  });
  mockOxy.session.setAccessToken(token('session-a'));
  const { dirname, join } = require('node:path');
  const dir = dirname(require.resolve('@oxy.so/services/package.json'));
  const { createOxyRuntime } = require(join(dir, 'lib/commonjs/ui/runtime/createOxyRuntime.js'));
  const { createAccountQueryPersistence } = require(
    join(dir, 'lib/commonjs/ui/hooks/accountQueryPersistence.js'),
  );
  mockRuntime = createOxyRuntime({
    oxyServices: mockOxy,
    sessionClient: { getState: () => null, getDirectory: () => null, subscribe: () => () => {} },
    sessionClientHost: { setCurrentAccountId: () => {} },
    identity: null,
    onDeviceEmpty: async () => {},
    logger: () => {},
  });
  mockRuntime.batch(() => {
    mockRuntime.setAccount({ id: 'alice' });
    mockRuntime.setActiveSessionId('session-a');
  });
  const client = createInboxQueryClient();
  const persistence = createAccountQueryPersistence(client, INBOX_ACCOUNT_QUERIES);
  persistence.setStorage({
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  });
  persistence.attach();
  persistence.activate('alice');
  await persistence.whenReady();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const change = () =>
    act(() => {
      mockOxy.session.setAccessToken(token('session-b'));
      mockRuntime.setActiveSessionId('session-b');
      persistence.activate('alice');
    });
  const cleanup = () => {
    persistence.detach();
    client.clear();
    mockOxy.dispose();
    jest.restoreAllMocks();
  };
  return { client, wrapper, change, cleanup };
}
it('does not reuse a prior session inline signed URL', async () => {
  const { wrapper, change, cleanup } = await setup();
  const lookup = jest.spyOn(mockOxy.assets, 'url').mockResolvedValue('https://files.test/signed-a');
  const hook = renderHook(() => useCidResolver(messages, mockOxy, 'm1'), { wrapper });
  await waitFor(() => expect(hook.result.current.m1).toContain('https://files.test/signed-a'));
  lookup.mockImplementation(() => new Promise(() => {}));
  change();
  hook.rerender();
  expect(hook.result.current.m1).not.toContain('https://files.test/signed-a');
  hook.unmount();
  cleanup();
});
it('does not reuse a prior session thumbnail URL', async () => {
  const { wrapper, change, cleanup } = await setup();
  const lookup = jest.spyOn(mockOxy.assets, 'url').mockResolvedValue('https://files.test/thumb-a');
  const hook = renderHook(() => useAttachmentUrl('file-a', true, 'thumb'), { wrapper });
  await waitFor(() => expect(hook.result.current.url).toBe('https://files.test/thumb-a'));
  lookup.mockImplementation(() => new Promise(() => {}));
  change();
  hook.rerender();
  expect(hook.result.current.url).not.toBe('https://files.test/thumb-a');
  hook.unmount();
  cleanup();
});

it('does not publish an A lookup that resolves after a same-subject session switch', async () => {
  const { wrapper, change, cleanup } = await setup();
  const resolves: ((url: string) => void)[] = [];
  const lookup = jest.spyOn(mockOxy.assets, 'url').mockImplementation(
    () =>
      new Promise((resolve) => {
        resolves.push(resolve);
      }),
  );
  const hook = renderHook(() => useCidResolver(messages, mockOxy, 'm1'), { wrapper });
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
  change();
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(2));
  await act(async () => {
    resolves[0]('https://files.test/signed-a');
  });
  expect(hook.result.current.m1).toContain('cid:logo@example');
  await act(async () => {
    resolves[1]('https://files.test/signed-b');
  });
  await waitFor(() => expect(hook.result.current.m1).toContain('https://files.test/signed-b'));
  hook.unmount();
  cleanup();
});

it('does not revive an old A lookup after A to B to A', async () => {
  const { wrapper, change, cleanup } = await setup();
  const resolves: ((url: string) => void)[] = [];
  const lookup = jest.spyOn(mockOxy.assets, 'url').mockImplementation(
    () =>
      new Promise((resolve) => {
        resolves.push(resolve);
      }),
  );
  const hook = renderHook(() => useCidResolver(messages, mockOxy, 'm1'), { wrapper });
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
  change();
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(2));
  act(() => {
    mockOxy.session.setAccessToken(token('session-a'));
    mockRuntime.setActiveSessionId('session-a');
  });
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(3));
  await act(async () => {
    resolves[0]('https://files.test/old-a');
    resolves[1]('https://files.test/old-b');
  });
  expect(hook.result.current.m1).toContain('cid:logo@example');
  await act(async () => {
    resolves[2]('https://files.test/new-a');
  });
  await waitFor(() => expect(hook.result.current.m1).toContain('https://files.test/new-a'));
  hook.unmount();
  cleanup();
});

it('does not fetch or display a URL while the supplied transport differs', async () => {
  const { wrapper, cleanup } = await setup();
  const original = mockOxy;
  jest.spyOn(original.assets, 'url').mockResolvedValue('https://files.test/signed-a');
  const hook = renderHook(({ source }) => useCidResolver(messages, source, 'm1'), {
    wrapper,
    initialProps: { source: original },
  });
  await waitFor(() => expect(hook.result.current.m1).toContain('https://files.test/signed-a'));
  const other = new OxyServices({ baseURL: 'https://other.test', enableCache: false });
  const otherLookup = jest.spyOn(other.assets, 'url');
  hook.rerender({ source: other });
  expect(hook.result.current.m1).toContain('cid:logo@example');
  expect(otherLookup).not.toHaveBeenCalled();
  hook.unmount();
  cleanup();
  other.dispose();
});

it('does not publish an old URL after the last observer unmounts and the same scope remounts', async () => {
  const { wrapper, client, cleanup } = await setup();
  const pending: ((url: string) => void)[] = [];
  const lookup = jest.spyOn(mockOxy.assets, 'url').mockImplementation(
    () =>
      new Promise((resolve) => {
        pending.push(resolve);
      }),
  );
  const first = renderHook(() => useCidResolver(messages, mockOxy, 'm1'), { wrapper });
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
  first.unmount();
  const second = renderHook(() => useCidResolver(messages, mockOxy, 'm1'), { wrapper });
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(2));
  await act(async () => {
    pending[0]('https://files.test/old-a');
  });
  expect(second.result.current.m1).toContain('cid:logo@example');
  expect(
    client
      .getQueryCache()
      .getAll()
      .some((query) => query.state.data === 'https://files.test/old-a'),
  ).toBe(false);
  await act(async () => {
    pending[1]('https://files.test/new-a');
  });
  await waitFor(() => expect(second.result.current.m1).toContain('https://files.test/new-a'));
  second.unmount();
  cleanup();
});

it('finishes a shared lookup for another observer when the first unmounts', async () => {
  const { wrapper, cleanup } = await setup();
  let finish: (url: string) => void = () => {};
  const lookup = jest.spyOn(mockOxy.assets, 'url').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const first = renderHook(() => useCidResolver(messages, mockOxy, 'm1'), { wrapper });
  const second = renderHook(() => useCidResolver(messages, mockOxy, 'm1'), { wrapper });
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
  first.unmount();
  await act(async () => {
    finish('https://files.test/shared');
  });
  await waitFor(() => expect(second.result.current.m1).toContain('https://files.test/shared'));
  second.unmount();
  cleanup();
});

it('does not revive a pending URL after a runtime replacement A to B to A', async () => {
  const { wrapper, cleanup } = await setup();
  const pending: ((url: string) => void)[] = [];
  const lookup = jest.spyOn(mockOxy.assets, 'url').mockImplementation(
    () =>
      new Promise((resolve) => {
        pending.push(resolve);
      }),
  );
  const hook = renderHook(() => useCidResolver(messages, mockOxy, 'm1'), { wrapper });
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
  const oldRuntime = mockRuntime;
  const { dirname, join } = require('node:path');
  const dir = dirname(require.resolve('@oxy.so/services/package.json'));
  const { createOxyRuntime } = require(join(dir, 'lib/commonjs/ui/runtime/createOxyRuntime.js'));
  mockRuntime = createOxyRuntime({
    oxyServices: mockOxy,
    sessionClient: { getState: () => null, getDirectory: () => null, subscribe: () => () => {} },
    sessionClientHost: { setCurrentAccountId: () => {} },
    identity: null,
    onDeviceEmpty: async () => {},
    logger: () => {},
  });
  mockRuntime.batch(() => {
    mockRuntime.setAccount({ id: 'alice' });
    mockRuntime.setActiveSessionId('session-a');
  });
  hook.rerender();
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(2));
  mockRuntime = oldRuntime;
  hook.rerender();
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(3));
  await act(async () => {
    pending[0]('https://files.test/old-a');
    pending[1]('https://files.test/old-b');
  });
  expect(hook.result.current.m1).toContain('cid:logo@example');
  await act(async () => {
    pending[2]('https://files.test/current');
  });
  await waitFor(() => expect(hook.result.current.m1).toContain('https://files.test/current'));
  hook.unmount();
  cleanup();
});

it('leaves committed CID work valid during a suspended replacement render', async () => {
  const { client, cleanup } = await setup();
  let finish: (url: string) => void = () => {};
  const lookup = jest.spyOn(mockOxy.assets, 'url').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const oldRuntime = mockRuntime;
  const never = new Promise(() => {});
  function Gate({ waiting }: { waiting: boolean }) {
    if (waiting) throw never;
    return null;
  }
  function Content() {
    const html = useCidResolver(messages, mockOxy, 'm1');
    return <output>{html.m1}</output>;
  }
  const tree = (waiting: boolean, runtime: typeof mockRuntime) => (
    <mockRuntimeContext.Provider value={runtime}>
      <QueryClientProvider client={client}>
        <Suspense fallback={<div>loading</div>}>
          <Content />
          <Gate waiting={waiting} />
        </Suspense>
      </QueryClientProvider>
    </mockRuntimeContext.Provider>
  );
  const view = render(tree(false, oldRuntime));
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
  const { dirname, join } = require('node:path');
  const dir = dirname(require.resolve('@oxy.so/services/package.json'));
  const { createOxyRuntime } = require(join(dir, 'lib/commonjs/ui/runtime/createOxyRuntime.js'));
  mockRuntime = createOxyRuntime({
    oxyServices: mockOxy,
    sessionClient: { getState: () => null, getDirectory: () => null, subscribe: () => () => {} },
    sessionClientHost: { setCurrentAccountId: () => {} },
    identity: null,
    onDeviceEmpty: async () => {},
    logger: () => {},
  });
  mockRuntime.batch(() => {
    mockRuntime.setAccount({ id: 'alice' });
    mockRuntime.setActiveSessionId('session-a');
  });
  act(() => startTransition(() => view.rerender(tree(true, mockRuntime))));
  expect(view.queryByText('loading')).toBeNull();
  await act(async () => {
    finish('https://files.test/committed');
  });
  await waitFor(() =>
    expect(view.container.querySelector('output')?.textContent).toContain(
      'https://files.test/committed',
    ),
  );
  view.unmount();
  mockRuntime = oldRuntime;
  cleanup();
});

it('resolves CID images after StrictMode effect replay', async () => {
  const { client, cleanup } = await setup();
  jest.spyOn(mockOxy.assets, 'url').mockResolvedValue('https://files.test/current');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <StrictMode>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </StrictMode>
  );
  const hook = renderHook(() => useCidResolver(messages, mockOxy, 'm1'), { wrapper });
  await waitFor(() => expect(hook.result.current.m1).toContain('https://files.test/current'));
  hook.unmount();
  cleanup();
});

it('does not retry a failed A lookup into B when connectivity returns', async () => {
  onlineManager.setOnline(false);
  const { wrapper, change, client, cleanup } = await setup();
  client.setDefaultOptions({ queries: { networkMode: 'offlineFirst', retry: false } });
  let finishB: (url: string) => void = () => {};
  const lookup = jest
    .spyOn(mockOxy.assets, 'url')
    .mockRejectedValueOnce(new Error('offline'))
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishB = resolve;
        }),
    );
  const hook = renderHook(() => useCidResolver(messages, mockOxy, 'm1'), { wrapper });
  try {
    await waitFor(() =>
      expect(
        client
          .getQueryCache()
          .getAll()
          .some((q) => q.state.status === 'error'),
      ).toBe(true),
    );
    expect(lookup).toHaveBeenCalledTimes(1);
    change();
    await waitFor(() => expect(lookup).toHaveBeenCalledTimes(2));
    act(() => onlineManager.setOnline(true));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(lookup).toHaveBeenCalledTimes(2);
    await act(async () => {
      finishB('https://files.test/signed-b');
    });
    await waitFor(() => expect(hook.result.current.m1).toContain('https://files.test/signed-b'));
  } finally {
    hook.unmount();
    cleanup();
    onlineManager.setOnline(true);
  }
});

it('shares one same-variant request between CID and the attachment hook', async () => {
  const { wrapper, cleanup } = await setup();
  let finish: (url: string) => void = () => {};
  const lookup = jest.spyOn(mockOxy.assets, 'url').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const hook = renderHook(
    () => ({
      cid: useCidResolver(messages, mockOxy, 'm1'),
      attachment: useAttachmentUrl('file-a'),
    }),
    { wrapper },
  );
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
  await act(async () => {
    finish('https://files.test/shared');
  });
  await waitFor(() => expect(hook.result.current.cid.m1).toContain('https://files.test/shared'));
  await waitFor(() => expect(hook.result.current.attachment.url).toBe('https://files.test/shared'));
  expect(lookup).toHaveBeenCalledTimes(1);
  hook.unmount();
  cleanup();
});

it('does not display a thumbnail response from an earlier session', async () => {
  const { wrapper, change, cleanup } = await setup();
  const pending: ((url: string) => void)[] = [];
  const lookup = jest.spyOn(mockOxy.assets, 'url').mockImplementation(
    () =>
      new Promise((resolve) => {
        pending.push(resolve);
      }),
  );
  const hook = renderHook(() => useAttachmentUrl('file-a', true, 'thumb'), { wrapper });
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
  change();
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(2));
  await act(async () => {
    pending[0]('https://files.test/old');
  });
  expect(hook.result.current.url).toBeNull();
  await act(async () => {
    pending[1]('https://files.test/new');
  });
  await waitFor(() => expect(hook.result.current.url).toBe('https://files.test/new'));
  hook.unmount();
  cleanup();
});

it('reuses a confirmed same-session thumbnail on an offline remount', async () => {
  const { wrapper, cleanup } = await setup();
  const lookup = jest.spyOn(mockOxy.assets, 'url').mockResolvedValue('https://files.test/current');
  const first = renderHook(() => useAttachmentUrl('file-a', true, 'thumb'), { wrapper });
  await waitFor(() => expect(first.result.current.url).toBe('https://files.test/current'));
  first.unmount();
  onlineManager.setOnline(false);
  lookup.mockRejectedValue(new Error('offline'));
  const second = renderHook(() => useAttachmentUrl('file-a', true, 'thumb'), { wrapper });
  try {
    expect(second.result.current.url).toBe('https://files.test/current');
    expect(lookup).toHaveBeenCalledTimes(1);
  } finally {
    second.unmount();
    cleanup();
    onlineManager.setOnline(true);
  }
});

it('lets the remaining thumbnail observer finish a shared request', async () => {
  const { wrapper, cleanup } = await setup();
  let finish: (url: string) => void = () => {};
  const lookup = jest.spyOn(mockOxy.assets, 'url').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const first = renderHook(() => useAttachmentUrl('file-a', true, 'thumb'), { wrapper });
  const second = renderHook(() => useAttachmentUrl('file-a', true, 'thumb'), { wrapper });
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
  first.unmount();
  await act(async () => {
    finish('https://files.test/shared');
  });
  await waitFor(() => expect(second.result.current.url).toBe('https://files.test/shared'));
  second.unmount();
  cleanup();
});

it('does not let an old thumbnail lookup populate a new lease after remount', async () => {
  const { wrapper, cleanup } = await setup();
  const pending: ((url: string) => void)[] = [];
  const lookup = jest.spyOn(mockOxy.assets, 'url').mockImplementation(
    () =>
      new Promise((resolve) => {
        pending.push(resolve);
      }),
  );
  const first = renderHook(() => useAttachmentUrl('file-a', true, 'thumb'), { wrapper });
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
  first.unmount();
  const second = renderHook(() => useAttachmentUrl('file-a', true, 'thumb'), { wrapper });
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(2));
  await act(async () => {
    pending[0]('https://files.test/old');
  });
  expect(second.result.current.url).toBeNull();
  await act(async () => {
    pending[1]('https://files.test/new');
  });
  await waitFor(() => expect(second.result.current.url).toBe('https://files.test/new'));
  second.unmount();
  cleanup();
});

it('keeps different attachment variants in separate requests', async () => {
  const { wrapper, cleanup } = await setup();
  const lookup = jest
    .spyOn(mockOxy.assets, 'url')
    .mockImplementation(async (_id, variant) => `https://files.test/${variant ?? 'original'}`);
  const hook = renderHook(
    () => ({
      cid: useCidResolver(messages, mockOxy, 'm1'),
      thumbnail: useAttachmentUrl('file-a', true, 'thumb'),
    }),
    { wrapper },
  );
  await waitFor(() => expect(hook.result.current.cid.m1).toContain('https://files.test/original'));
  await waitFor(() => expect(hook.result.current.thumbnail.url).toBe('https://files.test/thumb'));
  expect(lookup).toHaveBeenCalledTimes(2);
  hook.unmount();
  cleanup();
});

it('does not revive a pending thumbnail after runtime replacement A to B to A', async () => {
  const { wrapper, cleanup } = await setup();
  const pending: ((url: string) => void)[] = [];
  const lookup = jest.spyOn(mockOxy.assets, 'url').mockImplementation(
    () =>
      new Promise((resolve) => {
        pending.push(resolve);
      }),
  );
  const hook = renderHook(() => useAttachmentUrl('file-a', true, 'thumb'), { wrapper });
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
  const oldRuntime = mockRuntime;
  const { dirname, join } = require('node:path');
  const dir = dirname(require.resolve('@oxy.so/services/package.json'));
  const { createOxyRuntime } = require(join(dir, 'lib/commonjs/ui/runtime/createOxyRuntime.js'));
  mockRuntime = createOxyRuntime({
    oxyServices: mockOxy,
    sessionClient: { getState: () => null, getDirectory: () => null, subscribe: () => () => {} },
    sessionClientHost: { setCurrentAccountId: () => {} },
    identity: null,
    onDeviceEmpty: async () => {},
    logger: () => {},
  });
  mockRuntime.batch(() => {
    mockRuntime.setAccount({ id: 'alice' });
    mockRuntime.setActiveSessionId('session-a');
  });
  hook.rerender();
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(2));
  mockRuntime = oldRuntime;
  hook.rerender();
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(3));
  await act(async () => {
    pending[0]('https://files.test/old-a');
    pending[1]('https://files.test/old-b');
  });
  expect(hook.result.current.url).toBeNull();
  await act(async () => {
    pending[2]('https://files.test/current');
  });
  await waitFor(() => expect(hook.result.current.url).toBe('https://files.test/current'));
  hook.unmount();
  cleanup();
});

it('lets a committed thumbnail finish while the replacement runtime render suspends', async () => {
  const { client, cleanup } = await setup();
  let finish: (url: string) => void = () => {};
  const lookup = jest.spyOn(mockOxy.assets, 'url').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const oldRuntime = mockRuntime;
  const never = new Promise(() => {});
  function Gate({ waiting }: { waiting: boolean }) {
    if (waiting) throw never;
    return null;
  }
  function Content() {
    const { url } = useAttachmentUrl('file-a', true, 'thumb');
    return <output>{url ?? 'pending'}</output>;
  }
  const tree = (waiting: boolean, runtime: typeof mockRuntime) => (
    <mockRuntimeContext.Provider value={runtime}>
      <QueryClientProvider client={client}>
        <Suspense fallback={<div>loading</div>}>
          <Content />
          <Gate waiting={waiting} />
        </Suspense>
      </QueryClientProvider>
    </mockRuntimeContext.Provider>
  );
  const view = render(tree(false, oldRuntime));
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
  const { dirname, join } = require('node:path');
  const dir = dirname(require.resolve('@oxy.so/services/package.json'));
  const { createOxyRuntime } = require(join(dir, 'lib/commonjs/ui/runtime/createOxyRuntime.js'));
  mockRuntime = createOxyRuntime({
    oxyServices: mockOxy,
    sessionClient: { getState: () => null, getDirectory: () => null, subscribe: () => () => {} },
    sessionClientHost: { setCurrentAccountId: () => {} },
    identity: null,
    onDeviceEmpty: async () => {},
    logger: () => {},
  });
  mockRuntime.batch(() => {
    mockRuntime.setAccount({ id: 'alice' });
    mockRuntime.setActiveSessionId('session-a');
  });
  act(() => startTransition(() => view.rerender(tree(true, mockRuntime))));
  expect(view.queryByText('loading')).toBeNull();
  await act(async () => {
    finish('https://files.test/current');
  });
  await waitFor(() =>
    expect(view.container.querySelector('output')?.textContent).toBe('https://files.test/current'),
  );
  view.unmount();
  mockRuntime = oldRuntime;
  cleanup();
});

it('resolves a thumbnail after StrictMode effect replay', async () => {
  const { client, cleanup } = await setup();
  jest.spyOn(mockOxy.assets, 'url').mockResolvedValue('https://files.test/current');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <StrictMode>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </StrictMode>
  );
  const hook = renderHook(() => useAttachmentUrl('file-a', true, 'thumb'), { wrapper });
  await waitFor(() => expect(hook.result.current.url).toBe('https://files.test/current'));
  hook.unmount();
  cleanup();
});

it('lets CID finish the shared request after the thumbnail observer unmounts', async () => {
  const { wrapper, cleanup } = await setup();
  let finish: (url: string) => void = () => {};
  const lookup = jest.spyOn(mockOxy.assets, 'url').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const thumbnail = renderHook(() => useAttachmentUrl('file-a'), { wrapper });
  const cid = renderHook(() => useCidResolver(messages, mockOxy, 'm1'), { wrapper });
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
  thumbnail.unmount();
  await act(async () => {
    finish('https://files.test/shared');
  });
  await waitFor(() => expect(cid.result.current.m1).toContain('https://files.test/shared'));
  cid.unmount();
  cleanup();
});

it('lets a thumbnail finish the shared request after the CID observer unmounts', async () => {
  const { wrapper, cleanup } = await setup();
  let finish: (url: string) => void = () => {};
  const lookup = jest.spyOn(mockOxy.assets, 'url').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const cid = renderHook(() => useCidResolver(messages, mockOxy, 'm1'), { wrapper });
  const thumbnail = renderHook(() => useAttachmentUrl('file-a'), { wrapper });
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
  cid.unmount();
  await act(async () => {
    finish('https://files.test/shared');
  });
  await waitFor(() => expect(thumbnail.result.current.url).toBe('https://files.test/shared'));
  thumbnail.unmount();
  cleanup();
});

it('retries an initially offline thumbnail on reconnect', async () => {
  onlineManager.setOnline(false);
  const { wrapper, client, cleanup } = await setup();
  client.setDefaultOptions({ queries: { networkMode: 'offlineFirst', retry: false } });
  const lookup = jest
    .spyOn(mockOxy.assets, 'url')
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue('https://files.test/current');
  const hook = renderHook(() => useAttachmentUrl('file-a', true, 'thumb'), { wrapper });
  try {
    await waitFor(() =>
      expect(
        client
          .getQueryCache()
          .getAll()
          .some((q) => q.state.status === 'error'),
      ).toBe(true),
    );
    expect(hook.result.current.url).toBeNull();
    act(() => onlineManager.setOnline(true));
    await waitFor(() => expect(hook.result.current.url).toBe('https://files.test/current'));
    expect(lookup).toHaveBeenCalledTimes(2);
  } finally {
    hook.unmount();
    cleanup();
    onlineManager.setOnline(true);
  }
});

it('performs an explicit thumbnail refetch even when its cached URL is fresh', async () => {
  const { wrapper, client, cleanup } = await setup();
  const lookup = jest
    .spyOn(mockOxy.assets, 'url')
    .mockResolvedValueOnce('https://files.test/first')
    .mockResolvedValueOnce('https://files.test/second');
  const hook = renderHook(() => useAttachmentUrl('file-a', true, 'thumb'), { wrapper });
  await waitFor(() => expect(hook.result.current.url).toBe('https://files.test/first'));
  const cached = client
    .getQueryCache()
    .getAll()
    .find((q) => q.queryKey.includes('cid-scoped-v1') && !q.queryKey.includes('pending'));
  expect(cached).toBeDefined();
  await act(async () => {
    await client.refetchQueries({ queryKey: cached?.queryKey, exact: true });
  });
  await waitFor(() => expect(hook.result.current.url).toBe('https://files.test/second'));
  expect(lookup).toHaveBeenCalledTimes(2);
  hook.unmount();
  cleanup();
});

it('does not multiply the configured retries when CID and thumbnail share a failing request', async () => {
  const { wrapper, client, cleanup } = await setup();
  client.setDefaultOptions({ queries: { networkMode: 'offlineFirst', retry: 2, retryDelay: 0 } });
  const lookup = jest.spyOn(mockOxy.assets, 'url').mockRejectedValue(new Error('unavailable'));
  const hook = renderHook(
    () => ({
      cid: useCidResolver(messages, mockOxy, 'm1'),
      attachment: useAttachmentUrl('file-a'),
    }),
    { wrapper },
  );
  try {
    await waitFor(() =>
      expect(
        client
          .getQueryCache()
          .getAll()
          .some(
            (q) =>
              q.queryKey.includes('cid-scoped-v1') &&
              !q.queryKey.includes('pending') &&
              q.state.status === 'error',
          ),
      ).toBe(true),
    );
    expect(lookup).toHaveBeenCalledTimes(3);
  } finally {
    hook.unmount();
    cleanup();
  }
});
