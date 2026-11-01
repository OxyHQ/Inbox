import { act, render, renderHook } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { OxyServices } from '@oxy.so/core';
import { type ReactNode, startTransition, StrictMode, Suspense } from 'react';
import { createInboxQueryClient } from '@/hooks/queries/queryClient';

let mockOxy: OxyServices;
let mockRuntime: ReturnType<typeof import('@oxy.so/services/runtime').useOxyRuntime>;
let mockPlatform = 'web';
const mockDownload = jest.fn();
const mockShare = jest.fn();
const mockAvailable = jest.fn();
const mockToast = jest.fn();
jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({ oxyServices: mockOxy, user: { id: 'alice' } }),
}));
jest.mock('@oxy.so/services/runtime', () => ({ useOxyRuntime: () => mockRuntime }));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatform;
    },
  },
  Linking: { openURL: jest.fn() },
}));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  downloadAsync: (...args: unknown[]) => mockDownload(...args),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: () => mockAvailable(),
  shareAsync: (...args: unknown[]) => mockShare(...args),
}));
jest.mock('@oxy.so/bloom/toast', () => ({
  toast: { error: (...args: unknown[]) => mockToast(...args) },
}));
import { useOpenAttachment } from '@/hooks/useOpenAttachment';
function token(session: string) {
  return `e30.${Buffer.from(JSON.stringify({ userId: 'alice', sessionId: session, exp: 2000000000 })).toString('base64url')}.fixture`;
}
function setup() {
  mockAvailable.mockResolvedValue(true);
  mockOxy = new OxyServices({
    baseURL: 'https://api.test',
    enableRetry: false,
    enableCache: false,
  });
  mockOxy.session.setAccessToken(token('session-a'));
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
  const client = createInboxQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useOpenAttachment(), { wrapper });
  const change = () =>
    act(() => {
      mockOxy.session.setAccessToken(token('session-b'));
      mockRuntime.setActiveSessionId('session-b');
      hook.rerender();
    });
  const cleanup = () => {
    hook.unmount();
    client.clear();
    mockOxy.dispose();
    jest.restoreAllMocks();
    mockDownload.mockReset();
    mockShare.mockReset();
    mockAvailable.mockReset();
    mockToast.mockReset();
  };
  return { hook, change, cleanup };
}
it('does not navigate the popup to the previous session signed URL', async () => {
  mockPlatform = 'web';
  const { hook, change, cleanup } = setup();
  let finish: (url: string) => void = () => {};
  jest.spyOn(mockOxy.assets, 'url').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const tab = { opener: {}, location: { href: '' }, close: jest.fn() };
  jest.spyOn(window, 'open').mockReturnValue(tab as never);
  let request: Promise<void> = Promise.resolve();
  act(() => {
    request = hook.result.current('file-a', 'a.txt');
  });
  change();
  expect(tab.close).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish('https://files.test/signed-a');
    await request;
  });
  expect(tab.location.href).toBe('');
  cleanup();
});
it('does not share a previous session download after switching session', async () => {
  mockPlatform = 'ios';
  const { hook, change, cleanup } = setup();
  jest.spyOn(mockOxy.assets, 'url').mockResolvedValue('https://files.test/signed-a');
  let finish: (result: { status: number; uri: string }) => void = () => {};
  mockDownload.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let request: Promise<void> = Promise.resolve();
  await act(async () => {
    request = hook.result.current('file-a', 'a.txt');
    await Promise.resolve();
  });
  expect(mockDownload).toHaveBeenCalled();
  change();
  await act(async () => {
    finish({ status: 200, uri: 'file:///cache/a.txt' });
    await request;
  });
  expect(mockShare).not.toHaveBeenCalled();
  cleanup();
});

it('opens a current session attachment on web with the popup created synchronously', async () => {
  mockPlatform = 'web';
  const { hook, cleanup } = setup();
  let finish: (url: string) => void = () => {};
  jest.spyOn(mockOxy.assets, 'url').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const tab = { opener: {}, location: { href: '' }, close: jest.fn() };
  const open = jest.spyOn(window, 'open').mockReturnValue(tab as never);
  let request: Promise<void> = Promise.resolve();
  act(() => {
    request = hook.result.current('file-a', 'a.txt');
  });
  expect(open).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish('https://files.test/signed-a');
    await request;
  });
  expect(tab.location.href).toBe('https://files.test/signed-a');
  expect(tab.opener).toBeNull();
  expect(tab.close).not.toHaveBeenCalled();
  cleanup();
});

it('shares a successful download in the current native session', async () => {
  mockPlatform = 'ios';
  const { hook, cleanup } = setup();
  jest.spyOn(mockOxy.assets, 'url').mockResolvedValue('https://files.test/signed-a');
  mockDownload.mockResolvedValue({ status: 200, uri: 'file:///cache/a.txt' });
  await act(async () => {
    await hook.result.current('file-a', 'a.txt');
  });
  expect(mockDownload).toHaveBeenCalledWith('https://files.test/signed-a', 'file:///cache/a.txt');
  expect(mockShare).toHaveBeenCalledWith('file:///cache/a.txt');
  cleanup();
});

it('closes an unresolved popup on unmount and blocks its later result', async () => {
  mockPlatform = 'web';
  const { hook, cleanup } = setup();
  let finish: (url: string) => void = () => {};
  jest.spyOn(mockOxy.assets, 'url').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const tab = { opener: {}, location: { href: '' }, close: jest.fn() };
  jest.spyOn(window, 'open').mockReturnValue(tab as never);
  let request: Promise<void> = Promise.resolve();
  act(() => {
    request = hook.result.current('file-a', 'a.txt');
  });
  hook.unmount();
  expect(tab.close).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish('https://files.test/signed-a');
    await request;
  });
  expect(tab.location.href).toBe('');
  cleanup();
});

it('does not run a retained callback after an observed A to B to A transition', async () => {
  mockPlatform = 'web';
  const { hook, change, cleanup } = setup();
  const old = hook.result.current;
  const open = jest.spyOn(window, 'open');
  const url = jest.spyOn(mockOxy.assets, 'url');
  change();
  act(() => {
    mockOxy.session.setAccessToken(token('session-a'));
    mockRuntime.setActiveSessionId('session-a');
    hook.rerender();
  });
  await act(async () => {
    await old('file-a', 'a.txt');
  });
  expect(open).not.toHaveBeenCalled();
  expect(url).not.toHaveBeenCalled();
  expect(mockToast).not.toHaveBeenCalled();
  cleanup();
});

it('shows a recoverable error when the current session is not ready', async () => {
  mockPlatform = 'web';
  const { hook, cleanup } = setup();
  act(() => {
    const mismatch = `e30.${Buffer.from(JSON.stringify({ userId: 'bob', sessionId: 'session-b', exp: 2000000000 })).toString('base64url')}.fixture`;
    mockOxy.session.setAccessToken(mismatch);
    hook.rerender();
  });
  const open = jest.spyOn(window, 'open');
  await act(async () => {
    await hook.result.current('file-a', 'a.txt');
  });
  expect(open).not.toHaveBeenCalled();
  expect(mockToast).toHaveBeenCalledWith('message.toast.attachmentSessionUnavailable');
  cleanup();
});

it('suppresses an old failure but reports a failure in the current session', async () => {
  mockPlatform = 'web';
  const { hook, change, cleanup } = setup();
  let fail: (reason: Error) => void = () => {};
  const url = jest
    .spyOn(mockOxy.assets, 'url')
    .mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    )
    .mockRejectedValue(new Error('current error'));
  const firstTab = { opener: {}, location: { href: '' }, close: jest.fn() };
  const secondTab = { opener: {}, location: { href: '' }, close: jest.fn() };
  jest
    .spyOn(window, 'open')
    .mockReturnValueOnce(firstTab as never)
    .mockReturnValueOnce(secondTab as never);
  let request: Promise<void> = Promise.resolve();
  act(() => {
    request = hook.result.current('file-a', 'a.txt');
  });
  change();
  await act(async () => {
    fail(new Error('old error'));
    await request;
  });
  expect(mockToast).not.toHaveBeenCalled();
  await act(async () => {
    await hook.result.current('file-b', 'b.txt');
  });
  expect(url).toHaveBeenCalledTimes(2);
  expect(secondTab.close).toHaveBeenCalled();
  expect(mockToast).toHaveBeenCalledWith('current error');
  cleanup();
});

it('does not begin downloading when the signed URL arrives after the session change', async () => {
  mockPlatform = 'ios';
  const { hook, change, cleanup } = setup();
  let finish: (url: string) => void = () => {};
  jest.spyOn(mockOxy.assets, 'url').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let request: Promise<void> = Promise.resolve();
  act(() => {
    request = hook.result.current('file-a', 'a.txt');
  });
  change();
  await act(async () => {
    finish('https://files.test/signed-a');
    await request;
  });
  expect(mockDownload).not.toHaveBeenCalled();
  expect(mockShare).not.toHaveBeenCalled();
  cleanup();
});

it('does not share if session changes while checking sharing availability', async () => {
  mockPlatform = 'ios';
  const { hook, change, cleanup } = setup();
  jest.spyOn(mockOxy.assets, 'url').mockResolvedValue('https://files.test/signed-a');
  mockDownload.mockResolvedValue({ status: 200, uri: 'file:///cache/a.txt' });
  let finish: (value: boolean) => void = () => {};
  mockAvailable.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let request: Promise<void> = Promise.resolve();
  await act(async () => {
    request = hook.result.current('file-a', 'a.txt');
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(mockAvailable).toHaveBeenCalled();
  change();
  await act(async () => {
    finish(true);
    await request;
  });
  expect(mockShare).not.toHaveBeenCalled();
  cleanup();
});

it('keeps a pending open across a same-session token refresh', async () => {
  mockPlatform = 'web';
  const { hook, cleanup } = setup();
  let finish: (url: string) => void = () => {};
  jest.spyOn(mockOxy.assets, 'url').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const tab = { opener: {}, location: { href: '' }, close: jest.fn() };
  jest.spyOn(window, 'open').mockReturnValue(tab as never);
  let request: Promise<void> = Promise.resolve();
  act(() => {
    request = hook.result.current('file-a', 'a.txt');
  });
  const refreshed = `e30.${Buffer.from(JSON.stringify({ userId: 'alice', sessionId: 'session-a', exp: 2000000000, jti: 'refresh' })).toString('base64url')}.fixture`;
  act(() => mockOxy.session.setAccessToken(refreshed));
  expect(tab.close).not.toHaveBeenCalled();
  await act(async () => {
    finish('https://files.test/signed-a');
    await request;
  });
  expect(tab.location.href).toBe('https://files.test/signed-a');
  cleanup();
});

it('retires an operation if an initially null projected session becomes known', async () => {
  mockPlatform = 'web';
  const { hook, cleanup } = setup();
  act(() => {
    mockRuntime.setActiveSessionId(null);
    hook.rerender();
  });
  let finish: (url: string) => void = () => {};
  jest.spyOn(mockOxy.assets, 'url').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const tab = { opener: {}, location: { href: '' }, close: jest.fn() };
  jest.spyOn(window, 'open').mockReturnValue(tab as never);
  let request: Promise<void> = Promise.resolve();
  act(() => {
    request = hook.result.current('file-a', 'a.txt');
  });
  act(() => {
    mockRuntime.setActiveSessionId('session-a');
    hook.rerender();
  });
  expect(tab.close).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish('https://files.test/signed-a');
    await request;
  });
  expect(tab.location.href).toBe('');
  cleanup();
});

it('does not share a native error response as a file', async () => {
  mockPlatform = 'ios';
  const { hook, cleanup } = setup();
  jest.spyOn(mockOxy.assets, 'url').mockResolvedValue('https://files.test/signed-a');
  mockDownload.mockResolvedValue({ status: 403, uri: 'file:///cache/a.txt' });
  await act(async () => {
    await hook.result.current('file-a', 'a.txt');
  });
  expect(mockShare).not.toHaveBeenCalled();
  expect(mockToast).toHaveBeenCalledWith('message.toast.attachmentFailed');
  cleanup();
});

it('does not finish A after replacing the Oxy runtime and HTTP service', async () => {
  mockPlatform = 'ios';
  const { hook, cleanup } = setup();
  const oldOxy = mockOxy;
  const oldRuntime = mockRuntime;
  const retained = hook.result.current;
  const oldUrl = jest.spyOn(oldOxy.assets, 'url').mockResolvedValue('https://files.test/signed-a');
  let finish: (result: { status: number; uri: string }) => void = () => {};
  mockDownload.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let request: Promise<void> = Promise.resolve();
  await act(async () => {
    request = hook.result.current('file-a', 'a.txt');
    await Promise.resolve();
  });
  expect(mockDownload).toHaveBeenCalled();
  const { dirname, join } = require('node:path');
  const dir = dirname(require.resolve('@oxy.so/services/package.json'));
  const { createOxyRuntime } = require(join(dir, 'lib/commonjs/ui/runtime/createOxyRuntime.js'));
  mockOxy = new OxyServices({
    baseURL: 'https://other.test',
    enableRetry: false,
    enableCache: false,
  });
  mockOxy.session.setAccessToken(token('session-a'));
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
  act(() => hook.rerender());
  await act(async () => {
    finish({ status: 200, uri: 'file:///cache/a.txt' });
    await request;
  });
  expect(mockShare).not.toHaveBeenCalled();
  await act(async () => {
    await retained('file-a', 'a.txt');
  });
  expect(oldUrl).toHaveBeenCalledTimes(1);
  const other = mockOxy;
  act(() => {
    mockOxy = oldOxy;
    mockRuntime = oldRuntime;
    hook.rerender();
  });
  await act(async () => {
    await retained('file-a', 'a.txt');
  });
  expect(oldUrl).toHaveBeenCalledTimes(1);
  cleanup();
  other.dispose();
});

it('keeps committed A active when a replacement render suspends before commit', async () => {
  mockPlatform = 'ios';
  const { cleanup } = setup();
  const oldOxy = mockOxy;
  const oldRuntime = mockRuntime;
  jest.spyOn(oldOxy.assets, 'url').mockResolvedValue('https://files.test/signed-a');
  let finish: (result: { status: number; uri: string }) => void = () => {};
  mockDownload.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const client = createInboxQueryClient();
  const suspended = new Promise(() => {});
  let open: (file: string, name: string) => Promise<void> = async () => {};
  function Probe({ waiting }: { waiting: boolean }) {
    const action = useOpenAttachment();
    if (waiting) throw suspended;
    open = action;
    return <div>committed</div>;
  }
  const tree = (waiting: boolean) => (
    <QueryClientProvider client={client}>
      <Suspense fallback={<div>loading</div>}>
        <Probe waiting={waiting} />
      </Suspense>
    </QueryClientProvider>
  );
  const view = render(tree(false));
  let request: Promise<void> = Promise.resolve();
  await act(async () => {
    request = open('file-a', 'a.txt');
    await Promise.resolve();
  });
  const { dirname, join } = require('node:path');
  const dir = dirname(require.resolve('@oxy.so/services/package.json'));
  const { createOxyRuntime } = require(join(dir, 'lib/commonjs/ui/runtime/createOxyRuntime.js'));
  mockOxy = new OxyServices({
    baseURL: 'https://other.test',
    enableRetry: false,
    enableCache: false,
  });
  mockOxy.session.setAccessToken(token('session-a'));
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
  act(() => startTransition(() => view.rerender(tree(true))));
  expect(view.getByText('committed')).toBeTruthy();
  await act(async () => {
    finish({ status: 200, uri: 'file:///cache/a.txt' });
    await request;
  });
  expect(mockShare).toHaveBeenCalledWith('file:///cache/a.txt');
  const other = mockOxy;
  view.unmount();
  client.clear();
  mockOxy = oldOxy;
  mockRuntime = oldRuntime;
  cleanup();
  other.dispose();
});

it('opens normally after StrictMode effect replay', async () => {
  mockPlatform = 'ios';
  const { cleanup } = setup();
  jest.spyOn(mockOxy.assets, 'url').mockResolvedValue('https://files.test/signed-a');
  mockDownload.mockResolvedValue({ status: 200, uri: 'file:///cache/a.txt' });
  const client = createInboxQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <StrictMode>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </StrictMode>
  );
  const hook = renderHook(() => useOpenAttachment(), { wrapper });
  await act(async () => {
    await hook.result.current('file-a', 'a.txt');
  });
  expect(mockShare).toHaveBeenCalledWith('file:///cache/a.txt');
  hook.unmount();
  client.clear();
  cleanup();
});

it.each(['android', 'ios'])(
  'keeps ordinary and Unicode attachment names in native file URIs on %s',
  async (platform) => {
    mockPlatform = platform;
    const { hook, cleanup } = setup();
    jest.spyOn(mockOxy.assets, 'url').mockResolvedValue('https://files.test/file');
    mockDownload.mockImplementation(async (_source: string, destination: string) => ({
      status: 200,
      uri: destination,
    }));
    mockShare.mockResolvedValue(undefined);
    const examples: [string, string][] = [
      ['ordinary.txt', 'ordinary.txt'],
      ['report #2.pdf', 'report #2.pdf'],
      ['50%.txt', '50%.txt'],
      ['中文 😀.png', '中文 😀.png'],
      ['bad\ud800name.txt', 'bad�name.txt'],
      [`${'a'.repeat(179)}😀.txt`, `${'a'.repeat(179)}�`],
    ];
    for (const [filename, expected] of examples) {
      await act(async () => {
        await hook.result.current('file', filename);
      });
      const destination = mockDownload.mock.calls.at(-1)?.[1] as string;
      const url = new URL(destination);
      expect(url.hash).toBe('');
      expect(url.search).toBe('');
      expect(decodeURIComponent(url.pathname.slice('/cache/'.length))).toBe(expected);
    }
    expect(mockToast).not.toHaveBeenCalled();
    cleanup();
  },
);
