import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useCallback, useRef, useState } from 'react';
import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { OxyServices } from '@oxy.so/core';
import type { ReactNode } from 'react';
import { useEmailStore } from '@/hooks/useEmail';
import { createInboxQueryClient } from '@/hooks/queries/queryClient';

let mockOxy: OxyServices;
let mockUser: string | null = 'alice';
let mockRuntime: ReturnType<typeof import('@oxy.so/services/runtime').useOxyRuntime>;
jest.mock('@oxy.so/services/runtime', () => ({ useOxyRuntime: () => mockRuntime }));
jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({ oxyServices: mockOxy, user: mockUser === null ? null : { id: mockUser } }),
}));
jest.mock('@oxy.so/bloom/toast', () => ({
  toast: Object.assign(jest.fn(), { error: jest.fn(), success: jest.fn() }),
}));
const mockTranslate = (key: string) => key;
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: mockTranslate }) }));

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ScrollView: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock('@/constants/theme', () => ({
  useColors: () => ({ error: 'red', secondaryText: 'gray' }),
}));
jest.mock('@oxy.so/bloom/button', () => ({
  Button: ({
    children,
    onPress,
    disabled,
  }: {
    children: ReactNode;
    onPress?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" disabled={disabled} onClick={onPress}>
      {children}
    </button>
  ),
  IconButton: () => null,
}));
jest.mock('@oxy.so/bloom/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useDialogControl: () => ({ open: () => {}, close: () => {} }),
}));
jest.mock('@oxy.so/bloom/text-field', () => ({
  TextFieldInput: ({
    label,
    value,
    onChangeText,
  }: {
    label: string;
    value: string;
    onChangeText?: (s: string) => void;
  }) => (
    <input
      aria-label={label}
      value={value}
      readOnly={!onChangeText}
      onChange={(e) => onChangeText?.(e.target.value)}
    />
  ),
}));
jest.mock('@oxy.so/bloom/mail-compose', () => ({
  MailComposeSurface: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock('@oxy.so/bloom/mail-thread', () => ({
  MailQuoteToggle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock('@oxy.so/bloom/typography', () => ({
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
jest.mock('@/components/MailAddressFields', () => ({ MailAddressFields: () => null }));
jest.mock('@/components/TemplatePicker', () => ({ TemplatePicker: () => null }));
jest.mock('@/components/ScheduleSendSheet', () => ({ ScheduleSendSheet: () => null }));
jest.mock('@/components/RichTextEditor', () => ({
  RichTextEditor: ({ value, onChange }: { value: string; onChange: (s: string) => void }) => (
    <textarea aria-label="editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
jest.mock('@/utils/composeBody', () => ({ editorContentToText: (s: string) => s }));
import { MailComposer } from '@/components/MailComposer';

function token(subject: string, session: string) {
  return `e30.${Buffer.from(JSON.stringify({ userId: subject, sessionId: session, exp: 2000000000 })).toString('base64url')}.fixture`;
}
let previousFetch: typeof fetch;
beforeEach(() => {
  jest.clearAllMocks();
  previousFetch = globalThis.fetch;
  mockUser = 'alice';
  mockOxy = new OxyServices({
    baseURL: 'https://api.test',
    enableRetry: false,
    enableCache: false,
  });
  mockOxy.session.setAccessToken(token('alice', 'a-session'));
  const { dirname, join } = require('node:path');
  const directory = dirname(require.resolve('@oxy.so/services/package.json'));
  const { createOxyRuntime } = require(
    join(directory, 'lib/commonjs/ui/runtime/createOxyRuntime.js'),
  );
  mockRuntime = createOxyRuntime({
    oxyServices: mockOxy,
    sessionClient: {
      getState: () => null,
      getDirectory: () => null,
      subscribe: () => () => {},
      refreshDirectory: async () => {},
      activateContext: async () => {},
      signOutContext: async () => {},
      signOutPrincipal: async () => {},
    },
    sessionClientHost: { setCurrentAccountId: () => {} },
    identity: null,
    onDeviceEmpty: async () => {},
    logger: () => {},
  });
  mockRuntime.batch(() => {
    mockRuntime.setAccount({ id: 'alice' });
    mockRuntime.setActiveSessionId('a-session');
  });
});
afterEach(() => {
  onlineManager.setOnline(true);
  useEmailStore.getState().resetAccountScopedState();
  mockOxy.dispose();
  globalThis.fetch = previousFetch;
});

function ComposeHarness() {
  const [body, setBody] = useState('Original unsaved text');
  const value = useRef(body);
  const revision = useRef(0);
  const composing = useRef(false);
  const updateBody = useCallback((next: string) => {
    if (value.current !== next) revision.current++;
    value.current = next;
    setBody(next);
  }, []);
  const setBodyComposing = useCallback((active: boolean) => {
    if (active && !composing.current) revision.current++;
    composing.current = active;
  }, []);
  const session = {
    body,
    ownText: body.replace(/<[^>]*>/g, ''),
    updateBody,
    getBodyRevision: () => revision.current,
    isBodyComposing: () => composing.current,
    setBodyComposing,
    replaceOwnText: updateBody,
    subject: '',
    attachments: [],
    hasUnsavedWork: true,
    sending: false,
    sendDisabled: false,
    sentVersion: null,
    draftStatusLabel: null,
    draftSaveError: null,
    to: '',
    cc: '',
    bcc: '',
    setTo: () => {},
    setCc: () => {},
    setBcc: () => {},
    setSubject: () => {},
    addFiles: () => {},
    removeAttachment: () => {},
    insertText: () => {},
    send: () => {},
    schedule: () => {},
    saveAndClose: () => {},
    discardDraft: () => {},
    discardChanges: () => {},
    sendAsNew: () => {},
    viewSent: () => {},
    dismissSentVersion: () => {},
  };
  return (
    <MailComposer
      session={session as never}
      layout="inline"
      title="Compose"
      trailer=""
      placeholder="Message"
    />
  );
}
it('does not overwrite new editor text with an earlier account stream', async () => {
  let release!: (value: { done: false; value: Uint8Array }) => void;
  const next = new Promise<{ done: false; value: Uint8Array }>((resolve) => {
    release = resolve;
  });
  const encoder = new TextEncoder();
  const reader = {
    read: jest
      .fn()
      .mockResolvedValueOnce({
        done: false,
        value: encoder.encode('data: {"type":"delta","text":"first"}\n\n'),
      })
      .mockImplementationOnce(() => next)
      .mockResolvedValueOnce({
        done: false,
        value: encoder.encode('data: {"type":"done","requestId":"req_01a06477"}\n\n'),
      }),
    cancel: jest.fn(async () => undefined),
    releaseLock: jest.fn(),
  };
  globalThis.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    headers: { get: () => 'text/event-stream' },
    body: { getReader: () => reader },
  })) as never;
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <ComposeHarness />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText('ai.draftDialog.label'), {
    target: { value: 'synthetic prompt' },
  });
  const buttons = screen.getAllByRole('button', { name: 'ai.toolbar.draft' });
  fireEvent.click(buttons[1]);
  await waitFor(() => expect(screen.getByText('first')).toBeTruthy());
  expect((screen.getByLabelText('editor') as HTMLTextAreaElement).value).toBe(
    'Original unsaved text',
  );
  act(() => {
    mockUser = 'bob';
    mockOxy.session.setAccessToken(token('bob', 'b-session'));
    mockRuntime.batch(() => {
      mockRuntime.setAccount({ id: 'bob' });
      mockRuntime.setActiveSessionId('b-session');
    });
    view.rerender(
      <QueryClientProvider client={client}>
        <ComposeHarness />
      </QueryClientProvider>,
    );
  });
  expect(screen.queryByText('first')).toBeNull();
  fireEvent.change(screen.getByLabelText('editor'), { target: { value: 'New user text' } });
  await act(async () => {
    release({ done: false, value: encoder.encode('data: {"type":"delta","text":" old"}\n\n') });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await waitFor(() => expect(reader.releaseLock).toHaveBeenCalled());
  expect((screen.getByLabelText('editor') as HTMLTextAreaElement).value).toBe('New user text');
  view.unmount();
  client.clear();
});

function controlledStream() {
  let release!: (value: { done: false; value: Uint8Array }) => void;
  const next = new Promise<{ done: false; value: Uint8Array }>((resolve) => {
    release = resolve;
  });
  const encoder = new TextEncoder();
  const reader = {
    read: jest
      .fn()
      .mockResolvedValueOnce({
        done: false,
        value: encoder.encode('data: {"type":"delta","text":"first"}\n\n'),
      })
      .mockImplementationOnce(() => next)
      .mockResolvedValueOnce({
        done: false,
        value: encoder.encode('data: {"type":"done","requestId":"req_01a06477"}\n\n'),
      }),
    cancel: jest.fn(async () => undefined),
    releaseLock: jest.fn(),
  };
  globalThis.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    headers: { get: () => 'text/event-stream' },
    body: { getReader: () => reader },
  })) as never;
  return {
    reader,
    finish: () =>
      release({
        done: false,
        value: encoder.encode('data: {"type":"delta","text":" complete"}\n\n'),
      }),
  };
}
function beginDraft() {
  fireEvent.change(screen.getByLabelText('ai.draftDialog.label'), {
    target: { value: 'synthetic prompt' },
  });
  fireEvent.click(screen.getAllByRole('button', { name: 'ai.toolbar.draft' })[1]);
}
it('applies a same-owner rewrite and preserves its original text for Undo', async () => {
  jest.spyOn(mockOxy.http, 'post').mockResolvedValueOnce({
    schemaVersion: 1,
    requestId: 'req_01a06477',
    text: 'Polished result',
  } as never);
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <ComposeHarness />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'ai.toolbar.polish' }));
  await waitFor(() =>
    expect((screen.getByLabelText('editor') as HTMLTextAreaElement).value).toBe('Polished result'),
  );
  const toast = require('@oxy.so/bloom/toast').toast as jest.Mock;
  const applied = toast.mock.calls.find(([message]) => message === 'ai.toast.applied');
  expect(applied).toBeDefined();
  act(() => applied?.[1].action.onClick());
  expect((screen.getByLabelText('editor') as HTMLTextAreaElement).value).toBe(
    'Original unsaved text',
  );
  view.unmount();
  client.clear();
});
it('does not let a rewrite Undo replace later editor changes', async () => {
  jest.spyOn(mockOxy.http, 'post').mockResolvedValueOnce({
    schemaVersion: 1,
    requestId: 'req_01a06477',
    text: 'Polished result',
  } as never);
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <ComposeHarness />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'ai.toolbar.polish' }));
  await waitFor(() =>
    expect((screen.getByLabelText('editor') as HTMLTextAreaElement).value).toBe('Polished result'),
  );
  const toast = require('@oxy.so/bloom/toast').toast as jest.Mock;
  const applied = toast.mock.calls.find(([message]) => message === 'ai.toast.applied');
  expect(applied).toBeDefined();
  fireEvent.change(screen.getByLabelText('editor'), { target: { value: 'Later edits' } });
  act(() => applied?.[1].action.onClick());
  expect((screen.getByLabelText('editor') as HTMLTextAreaElement).value).toBe('Later edits');
  expect(toast).toHaveBeenCalledWith('ai.toast.keptYourEdits');
  view.unmount();
  client.clear();
});
it('keeps a newer edit even if the text returns to its original value before polish completes', async () => {
  let finish!: (value: { schemaVersion: number; requestId: string; text: string }) => void;
  const response = new Promise<{ schemaVersion: number; requestId: string; text: string }>(
    (resolve) => {
      finish = resolve;
    },
  );
  jest.spyOn(mockOxy.http, 'post').mockReturnValueOnce(response as never);
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <ComposeHarness />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'ai.toolbar.polish' }));
  await waitFor(() => expect(mockOxy.http.post).toHaveBeenCalled());
  fireEvent.change(screen.getByLabelText('editor'), { target: { value: 'newer version' } });
  fireEvent.change(screen.getByLabelText('editor'), {
    target: { value: 'Original unsaved text' },
  });
  await act(async () => {
    finish({ schemaVersion: 1, requestId: 'req_01a06477', text: 'AI result' });
    await response;
  });
  expect((screen.getByLabelText('editor') as HTMLTextAreaElement).value).toBe(
    'Original unsaved text',
  );
  view.unmount();
  client.clear();
});
it('keeps formatting changed while polish is waiting even when the plain text is unchanged', async () => {
  let finish!: (value: { schemaVersion: number; requestId: string; text: string }) => void;
  const response = new Promise<{ schemaVersion: number; requestId: string; text: string }>(
    (resolve) => {
      finish = resolve;
    },
  );
  jest.spyOn(mockOxy.http, 'post').mockReturnValueOnce(response as never);
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <ComposeHarness />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'ai.toolbar.polish' }));
  await waitFor(() => expect(mockOxy.http.post).toHaveBeenCalled());
  fireEvent.change(screen.getByLabelText('editor'), {
    target: { value: '<b>Original unsaved text</b>' },
  });
  await act(async () => {
    finish({ schemaVersion: 1, requestId: 'req_01a06477', text: 'AI result' });
    await response;
  });
  expect((screen.getByLabelText('editor') as HTMLTextAreaElement).value).toBe(
    '<b>Original unsaved text</b>',
  );
  view.unmount();
  client.clear();
});
it('does not apply a polish result to a newly projected account', async () => {
  let finish!: (response: Response) => void;
  const response = new Promise<Response>((resolve) => {
    finish = resolve;
  });
  globalThis.fetch = jest.fn(() => response) as never;
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <ComposeHarness />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'ai.toolbar.polish' }));
  await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
  act(() => {
    mockUser = 'bob';
    mockRuntime.batch(() => {
      mockRuntime.setAccount({ id: 'bob' });
      mockRuntime.setActiveSessionId('b-session');
    });
    view.rerender(
      <QueryClientProvider client={client}>
        <ComposeHarness />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    finish({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ schemaVersion: 1, requestId: 'req_01a06477', text: 'AI result' }),
    } as unknown as Response);
    await response;
  });
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: 'ai.toolbar.polish' }) as HTMLButtonElement).disabled,
    ).toBe(false),
  );
  expect((screen.getByLabelText('editor') as HTMLTextAreaElement).value).toBe(
    'Original unsaved text',
  );
  view.unmount();
  client.clear();
});
it('previews separately, commits on success and restores the exact original through Undo', async () => {
  const stream = controlledStream();
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <ComposeHarness />
    </QueryClientProvider>,
  );
  beginDraft();
  await waitFor(() => expect(screen.getByText('first')).toBeTruthy());
  expect((screen.getByLabelText('editor') as HTMLTextAreaElement).value).toBe(
    'Original unsaved text',
  );
  await act(async () => {
    stream.finish();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await waitFor(() =>
    expect((screen.getByLabelText('editor') as HTMLTextAreaElement).value).toBe('first complete'),
  );
  const toast = require('@oxy.so/bloom/toast').toast as jest.Mock;
  const applied = toast.mock.calls.find(([message]) => message === 'ai.toast.applied');
  expect(applied).toBeDefined();
  act(() => applied?.[1].action.onClick());
  expect((screen.getByLabelText('editor') as HTMLTextAreaElement).value).toBe(
    'Original unsaved text',
  );
  view.unmount();
  client.clear();
});
it('keeps edits made while the same-account stream is running', async () => {
  const stream = controlledStream();
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <ComposeHarness />
    </QueryClientProvider>,
  );
  beginDraft();
  await waitFor(() => expect(screen.getByText('first')).toBeTruthy());
  fireEvent.change(screen.getByLabelText('editor'), { target: { value: 'Newer text' } });
  await act(async () => {
    stream.finish();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await waitFor(() => expect(stream.reader.releaseLock).toHaveBeenCalled());
  expect((screen.getByLabelText('editor') as HTMLTextAreaElement).value).toBe('Newer text');
  const toast = require('@oxy.so/bloom/toast').toast as jest.Mock;
  expect(toast).toHaveBeenCalledWith('ai.toast.keptYourEdits');
  expect(toast.mock.calls.some(([message]) => message === 'ai.toast.applied')).toBe(false);
  view.unmount();
  client.clear();
});
it('keeps the original editor content when a stream fails', async () => {
  const encoder = new TextEncoder();
  const reader = {
    read: jest
      .fn()
      .mockResolvedValueOnce({
        done: false,
        value: encoder.encode('data: {"type":"delta","text":"partial"}\n\n'),
      })
      .mockResolvedValueOnce({ done: true, value: undefined }),
    cancel: jest.fn(async () => undefined),
    releaseLock: jest.fn(),
  };
  globalThis.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    headers: { get: () => 'text/event-stream' },
    body: { getReader: () => reader },
  })) as never;
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <ComposeHarness />
    </QueryClientProvider>,
  );
  beginDraft();
  await waitFor(() =>
    expect(require('@oxy.so/bloom/toast').toast.error).toHaveBeenCalledWith('ai.toast.failed'),
  );
  expect((screen.getByLabelText('editor') as HTMLTextAreaElement).value).toBe(
    'Original unsaved text',
  );
  expect(screen.queryByText('partial')).toBeNull();
  view.unmount();
  client.clear();
});

it('does not let an old Undo replace text after a session change', async () => {
  const stream = controlledStream();
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <ComposeHarness />
    </QueryClientProvider>,
  );
  beginDraft();
  await waitFor(() => expect(screen.getByText('first')).toBeTruthy());
  await act(async () => {
    stream.finish();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await waitFor(() =>
    expect((screen.getByLabelText('editor') as HTMLTextAreaElement).value).toBe('first complete'),
  );
  const toast = require('@oxy.so/bloom/toast').toast as jest.Mock;
  const applied = toast.mock.calls.find(([message]) => message === 'ai.toast.applied');
  expect(applied).toBeDefined();
  act(() => {
    mockUser = 'bob';
    mockOxy.session.setAccessToken(token('bob', 'b-session'));
    mockRuntime.batch(() => {
      mockRuntime.setAccount({ id: 'bob' });
      mockRuntime.setActiveSessionId('b-session');
    });
    view.rerender(
      <QueryClientProvider client={client}>
        <ComposeHarness />
      </QueryClientProvider>,
    );
  });
  fireEvent.change(screen.getByLabelText('editor'), { target: { value: 'New user text' } });
  act(() => applied?.[1].action.onClick());
  expect((screen.getByLabelText('editor') as HTMLTextAreaElement).value).toBe('New user text');
  view.unmount();
  client.clear();
});
it('does not let Undo overwrite later edits from the same account', async () => {
  const stream = controlledStream();
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <ComposeHarness />
    </QueryClientProvider>,
  );
  beginDraft();
  await waitFor(() => expect(screen.getByText('first')).toBeTruthy());
  await act(async () => {
    stream.finish();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await waitFor(() =>
    expect((screen.getByLabelText('editor') as HTMLTextAreaElement).value).toBe('first complete'),
  );
  const toast = require('@oxy.so/bloom/toast').toast as jest.Mock;
  const applied = toast.mock.calls.find(([message]) => message === 'ai.toast.applied');
  expect(applied).toBeDefined();
  fireEvent.change(screen.getByLabelText('editor'), { target: { value: 'Later edit' } });
  act(() => applied?.[1].action.onClick());
  expect((screen.getByLabelText('editor') as HTMLTextAreaElement).value).toBe('Later edit');
  expect(toast).toHaveBeenCalledWith('ai.toast.keptYourEdits');
  view.unmount();
  client.clear();
});
