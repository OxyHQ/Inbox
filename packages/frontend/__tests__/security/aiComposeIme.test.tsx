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
  StyleSheet: { create: (styles: unknown) => styles },
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
jest.mock('@oxy.so/bloom/note-editor', () => ({ NoteEditorToolbar: () => null }));
jest.mock('@oxy.so/bloom/textarea', () => ({ Textarea: () => null }));
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
    ownText: body,
    updateBody,
    getBodyRevision: () => revision.current,
    getAiBodySnapshot: () => ({
      body: value.current,
      text: value.current,
      revision: revision.current,
    }),
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

it('does not replace uncommitted web IME text when a rewrite completes', async () => {
  Object.defineProperty(document, 'queryCommandState', { configurable: true, value: () => false });
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
  const editor = view.container.querySelector('[contenteditable="true"]') as HTMLDivElement | null;
  if (!editor) throw new Error('Expected web contentEditable editor');
  fireEvent.click(screen.getByRole('button', { name: 'ai.toolbar.polish' }));
  await waitFor(() => expect(mockOxy.http.post).toHaveBeenCalled());
  fireEvent.compositionStart(editor);
  editor.textContent = 'uncommitted IME text';
  fireEvent.input(editor);
  await act(async () => {
    finish({ schemaVersion: 1, requestId: 'req_01a06477', text: 'AI result' });
    await response;
  });
  const toast = require('@oxy.so/bloom/toast').toast as jest.Mock;
  await waitFor(() => expect(toast).toHaveBeenCalledWith('ai.toast.keptYourEdits'));
  expect(editor.textContent).toBe('uncommitted IME text');
  fireEvent.compositionEnd(editor);
  view.unmount();
  client.clear();
});

it.each(['before', 'during'] as const)(
  'keeps uncommitted web IME text when composition starts %s streaming',
  async (when) => {
    Object.defineProperty(document, 'queryCommandState', {
      configurable: true,
      value: () => false,
    });
    const stream = controlledStream();
    const client = createInboxQueryClient();
    const view = render(
      <QueryClientProvider client={client}>
        <ComposeHarness />
      </QueryClientProvider>,
    );
    const editor = view.container.querySelector(
      '[contenteditable="true"]',
    ) as HTMLDivElement | null;
    if (!editor) throw new Error('Expected web contentEditable editor');
    const compose = () => {
      fireEvent.compositionStart(editor);
      editor.textContent = 'uncommitted IME text';
      fireEvent.input(editor);
    };
    if (when === 'before') compose();
    beginDraft();
    await waitFor(() => expect(screen.getByText('first')).toBeTruthy());
    if (when === 'during') compose();
    await act(async () => {
      stream.finish();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const toast = require('@oxy.so/bloom/toast').toast as jest.Mock;
    await waitFor(() => expect(toast).toHaveBeenCalledWith('ai.toast.keptYourEdits'));
    expect(editor.textContent).toBe('uncommitted IME text');
    expect(toast.mock.calls.some(([message]) => message === 'ai.toast.applied')).toBe(false);
    fireEvent.compositionEnd(editor);
    expect(editor.textContent).toBe('uncommitted IME text');
    view.unmount();
    client.clear();
  },
);

it('does not let Undo overwrite web text that is still composing', async () => {
  Object.defineProperty(document, 'queryCommandState', { configurable: true, value: () => false });
  const stream = controlledStream();
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <ComposeHarness />
    </QueryClientProvider>,
  );
  const editor = view.container.querySelector('[contenteditable="true"]') as HTMLDivElement | null;
  if (!editor) throw new Error('Expected web contentEditable editor');
  beginDraft();
  await waitFor(() => expect(screen.getByText('first')).toBeTruthy());
  await act(async () => {
    stream.finish();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await waitFor(() => expect(editor.textContent).toBe('first complete'));
  const toast = require('@oxy.so/bloom/toast').toast as jest.Mock;
  const applied = toast.mock.calls.find(([message]) => message === 'ai.toast.applied');
  expect(applied).toBeDefined();
  fireEvent.compositionStart(editor);
  editor.textContent = 'uncommitted IME text';
  fireEvent.input(editor);
  act(() => applied?.[1].action.onClick());
  expect(editor.textContent).toBe('uncommitted IME text');
  expect(toast).toHaveBeenCalledWith('ai.toast.keptYourEdits');
  fireEvent.compositionEnd(editor);
  expect(editor.textContent).toBe('uncommitted IME text');
  view.unmount();
  client.clear();
});
