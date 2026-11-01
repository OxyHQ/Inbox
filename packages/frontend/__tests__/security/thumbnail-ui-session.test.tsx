import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { OxyServices } from '@oxy.so/core';
import type { ReactNode } from 'react';
import { createInboxQueryClient } from '@/hooks/queries/queryClient';

let mockOxy: OxyServices;
let mockRuntime: ReturnType<typeof import('@oxy.so/services/runtime').useOxyRuntime>;
let mockImageError: (() => void) | undefined;
let mockAvatarError: (() => void) | undefined;
jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({ oxyServices: mockOxy, user: { id: 'alice' } }),
}));
jest.mock('@oxy.so/services/runtime', () => ({ useOxyRuntime: () => mockRuntime }));
jest.mock('@/hooks/useOpenAttachment', () => ({ useOpenAttachment: () => jest.fn() }));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@oxy.so/bloom/icons/RiFileImageLine', () => ({ RiFileImageLine: () => null }));
jest.mock('@oxy.so/bloom/loading', () => ({ Loading: () => null }));
jest.mock('@oxy.so/bloom/avatar', () => {
  const React = require('react');
  function Image({ source }: { source: string | null }) {
    const [failed, setFailed] = React.useState(false);
    mockAvatarError = () => setFailed(true);
    return (
      <button type="button" data-testid="avatar" onClick={() => setFailed(true)}>
        {failed ? 'failed' : (source ?? 'empty')}
      </button>
    );
  }
  return {
    Avatar: ({ source }: { source: string | null }) => (
      <Image key={source ?? 'empty'} source={source} />
    ),
  };
});

jest.mock('react-native', () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Platform: { OS: 'web' },
  StyleSheet: { create: (styles: unknown) => styles },
}));
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@hugeicons/core-free-icons', () => ({}));
jest.mock('@hugeicons/react', () => ({ HugeiconsIcon: () => null }));
jest.mock('@oxy.so/bloom/card', () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock('@oxy.so/bloom/typography', () => ({
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
jest.mock('@oxy.so/bloom/theme', () => ({
  useTheme: () => ({
    colors: {
      successSubtleForeground: 'green',
      errorSubtleForeground: 'red',
      tertiarySubtleForeground: 'gray',
      infoSubtleForeground: 'blue',
      textSecondary: 'gray',
    },
  }),
}));
jest.mock('expo-image', () => ({
  Image: ({ source, onError }: { source: string; onError: () => void }) => {
    mockImageError = onError;
    return (
      <button type="button" data-testid="thumbnail" onClick={onError}>
        {source}
      </button>
    );
  },
}));
import { AttachmentPreview } from '@/components/AttachmentPreview';
import { AttachmentThumbnail } from '@/components/AttachmentThumbnail';

const attachment = { fileId: 'file-a', name: 'photo.png', contentType: 'image/png', size: 12 };
function token(session: string) {
  return `e30.${Buffer.from(JSON.stringify({ userId: 'alice', sessionId: session, exp: 2000000000 })).toString('base64url')}.fixture`;
}
function setup() {
  mockImageError = undefined;
  mockAvatarError = undefined;
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
  const lookup = jest.spyOn(mockOxy.assets, 'url').mockResolvedValue('https://files.test/same');
  const client = createInboxQueryClient();
  const tree = () => (
    <QueryClientProvider client={client}>
      <AttachmentPreview attachment={attachment} />
    </QueryClientProvider>
  );
  const view = render(tree());
  const change = () =>
    act(() => {
      mockOxy.session.setAccessToken(token('session-b'));
      mockRuntime.setActiveSessionId('session-b');
      view.rerender(tree());
    });
  const cleanup = () => {
    view.unmount();
    client.clear();
    mockOxy.dispose();
    jest.restoreAllMocks();
  };
  return { view, lookup, change, cleanup, client };
}
it('ignores a previous session image error even if the URL is unchanged', async () => {
  const { view, change, cleanup } = setup();
  await waitFor(() => expect(view.getByTestId('thumbnail')).toBeTruthy());
  const oldError = mockImageError;
  change();
  await waitFor(() => expect(view.getByTestId('thumbnail')).toBeTruthy());
  act(() => oldError?.());
  expect(view.getByTestId('thumbnail')).toBeTruthy();
  fireEvent.click(view.getByTestId('thumbnail'));
  expect(view.queryByTestId('thumbnail')).toBeNull();
  cleanup();
});
it('does not carry a failed image state into the next session', async () => {
  const { view, change, cleanup } = setup();
  await waitFor(() => expect(view.getByTestId('thumbnail')).toBeTruthy());
  fireEvent.click(view.getByTestId('thumbnail'));
  expect(view.queryByTestId('thumbnail')).toBeNull();
  change();
  await waitFor(() => expect(view.getByTestId('thumbnail')).toBeTruthy());
  cleanup();
});

it('ignores an old image error after the attachment changes A to B to A', async () => {
  const { view, cleanup } = setup();
  await waitFor(() => expect(view.getByTestId('thumbnail')).toBeTruthy());
  const oldError = mockImageError;
  const currentClient = createInboxQueryClient();
  // Keep a single mounted component while changing the attachment target.
  view.unmount();
  const tree = (fileId: string) => (
    <QueryClientProvider client={currentClient}>
      <AttachmentPreview attachment={{ ...attachment, fileId }} />
    </QueryClientProvider>
  );
  const current = render(tree('file-a'));
  await waitFor(() => expect(current.getByTestId('thumbnail')).toBeTruthy());
  const retained = mockImageError;
  current.rerender(tree('file-b'));
  await waitFor(() => expect(current.getByTestId('thumbnail')).toBeTruthy());
  current.rerender(tree('file-a'));
  await waitFor(() => expect(current.getByTestId('thumbnail')).toBeTruthy());
  act(() => {
    retained?.();
    oldError?.();
  });
  expect(current.getByTestId('thumbnail')).toBeTruthy();
  current.unmount();
  currentClient.clear();
  cleanup();
});

it('does not carry Avatar failure or late errors across cached session scopes', async () => {
  const { view, client, cleanup } = setup();
  view.unmount();
  const current = render(
    <QueryClientProvider client={client}>
      <AttachmentThumbnail fileId="file-a" />
    </QueryClientProvider>,
  );
  await waitFor(() =>
    expect(current.getByTestId('avatar').textContent).toBe('https://files.test/same'),
  );
  act(() => {
    mockOxy.session.setAccessToken(token('session-b'));
    mockRuntime.setActiveSessionId('session-b');
  });
  await waitFor(() =>
    expect(current.getByTestId('avatar').textContent).toBe('https://files.test/same'),
  );
  act(() => {
    mockOxy.session.setAccessToken(token('session-a'));
    mockRuntime.setActiveSessionId('session-a');
  });
  await waitFor(() =>
    expect(current.getByTestId('avatar').textContent).toBe('https://files.test/same'),
  );
  const oldError = mockAvatarError;
  fireEvent.click(current.getByTestId('avatar'));
  expect(current.getByTestId('avatar').textContent).toBe('failed');
  act(() => {
    mockOxy.session.setAccessToken(token('session-b'));
    mockRuntime.setActiveSessionId('session-b');
  });
  await waitFor(() =>
    expect(current.getByTestId('avatar').textContent).toBe('https://files.test/same'),
  );
  act(() => oldError?.());
  expect(current.getByTestId('avatar').textContent).toBe('https://files.test/same');
  current.unmount();
  cleanup();
});

it('resets an Avatar failure across cached runtime replacements with the same URL', async () => {
  const { view, client, cleanup } = setup();
  view.unmount();
  const tree = () => (
    <QueryClientProvider client={client}>
      <AttachmentThumbnail fileId="file-a" />
    </QueryClientProvider>
  );
  const current = render(tree());
  await waitFor(() =>
    expect(current.getByTestId('avatar').textContent).toBe('https://files.test/same'),
  );
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
  const nextRuntime = mockRuntime;
  current.rerender(tree());
  await waitFor(() =>
    expect(current.getByTestId('avatar').textContent).toBe('https://files.test/same'),
  );
  mockRuntime = oldRuntime;
  current.rerender(tree());
  expect(current.getByTestId('avatar').textContent).toBe('https://files.test/same');
  const retained = mockAvatarError;
  fireEvent.click(current.getByTestId('avatar'));
  expect(current.getByTestId('avatar').textContent).toBe('failed');
  mockRuntime = nextRuntime;
  current.rerender(tree());
  expect(current.getByTestId('avatar').textContent).toBe('https://files.test/same');
  act(() => retained?.());
  expect(current.getByTestId('avatar').textContent).toBe('https://files.test/same');
  current.unmount();
  mockRuntime = oldRuntime;
  cleanup();
});
