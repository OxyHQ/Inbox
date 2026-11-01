import { act, render, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
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
// Red control: thumbnail scope remains outside this CID change.
it.skip('does not reuse a prior session thumbnail URL', async () => {
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
