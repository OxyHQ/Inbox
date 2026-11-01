import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useCallback, useRef, useState } from 'react';
import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { OxyServices } from '@oxy.so/core';
import type { ReactNode } from 'react';
import { useEmailStore } from '@/hooks/useEmail';
import { createInboxQueryClient } from '@/hooks/queries/queryClient';

let mockOxy: OxyServices;
let mockUser: string | null = 'alice';
let mockSubjectBlurWithoutText = false;
let mockLatestSubjectEndEditing: ((value: string) => void) | undefined;
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
jest.mock('@/components/MailAddressFields', () => ({
  MailAddressFields: ({
    subject,
    onSubjectChange,
    onSubjectFocus,
    onSubjectBlur,
    onSubjectEndEditing,
    subjectInputRef,
  }: {
    subject: string;
    onSubjectChange: (value: string) => void;
    onSubjectFocus: () => void;
    onSubjectBlur: (value: string | undefined) => void;
    onSubjectEndEditing: (value: string) => void;
    subjectInputRef: React.RefObject<HTMLInputElement | null>;
  }) => {
    mockLatestSubjectEndEditing = onSubjectEndEditing;
    return (
      <>
        <input
          ref={subjectInputRef}
          aria-label="subject"
          value={subject}
          onChange={(event) => onSubjectChange(event.target.value)}
          onFocus={onSubjectFocus}
          onBlur={(event) =>
            onSubjectBlur(mockSubjectBlurWithoutText ? undefined : event.target.value)
          }
        />
        {mockSubjectBlurWithoutText && (
          <button type="button" onClick={() => onSubjectEndEditing('IME final subject')}>
            finish subject editing
          </button>
        )}
      </>
    );
  },
}));
jest.mock('@/components/TemplatePicker', () => ({ TemplatePicker: () => null }));
jest.mock('@/components/ScheduleSendSheet', () => ({ ScheduleSendSheet: () => null }));
jest.mock('@/components/RichTextEditor', () => ({
  RichTextEditor: ({ value, onChange }: { value: string; onChange: (s: string) => void }) => (
    <textarea aria-label="editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/hooks/mutations/useMessageMutations', () => ({
  useSendMessageWithUndo: () => ({ sendWithUndo: jest.fn(), isPending: false }),
  useSendMessage: () => ({ mutate: jest.fn(), isPending: false }),
  useSaveDraft: () => ({ mutateAsync: jest.fn() }),
  useDiscardDraft: () => ({ mutateAsync: jest.fn(), discardErrorNotice: () => 'current' }),
}));
import { MailComposer } from '@/components/MailComposer';
import { useComposeSession } from '@/hooks/useComposeSession';

function token(subject: string, session: string) {
  return `e30.${Buffer.from(JSON.stringify({ userId: subject, sessionId: session, exp: 2000000000 })).toString('base64url')}.fixture`;
}
let previousFetch: typeof fetch;
beforeEach(() => {
  jest.clearAllMocks();
  mockSubjectBlurWithoutText = false;
  mockLatestSubjectEndEditing = undefined;
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
  const [subject, setSubjectState] = useState('');
  const subjectValue = useRef('');
  const subjectRevision = useRef(0);
  const setSubject = useCallback((next: string) => {
    if (subjectValue.current !== next) subjectRevision.current++;
    subjectValue.current = next;
    setSubjectState(next);
  }, []);
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
    getAiBodySnapshot: () => ({
      body: value.current,
      text: value.current.replace(/<[^>]*>/g, ''),
      revision: revision.current,
    }),
    isBodyComposing: () => composing.current,
    setBodyComposing,
    replaceOwnText: updateBody,
    subject,
    getSubjectSnapshot: () => ({ value: subjectValue.current, revision: subjectRevision.current }),
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
    setSubject,
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
function RealComposeHarness() {
  const session = useComposeSession({
    recoveryIdentity: 'synthetic-batch',
    initial: { body: 'Original unsaved text' },
    awaitingReplyHeaders: false,
    insertSignature: false,
    onFinished: () => {},
  });
  return (
    <>
      <button
        type="button"
        onClick={() => {
          session.updateBody('newer body');
          Array.from(document.querySelectorAll('button'))
            .find((button) => button.textContent === 'ai.toolbar.polish')
            ?.click();
        }}
      >
        edit then polish
      </button>
      <button
        type="button"
        onClick={() => {
          session.updateBody('newer body');
          Array.from(document.querySelectorAll('button'))
            .filter((button) => button.textContent === 'ai.toolbar.draft')[1]
            ?.click();
        }}
      >
        edit then draft
      </button>
      <button
        type="button"
        onClick={() => {
          session.setSubject('new subject');
          Array.from(document.querySelectorAll('button'))
            .find((button) => button.textContent === 'ai.toolbar.suggestSubject')
            ?.click();
        }}
      >
        edit subject then suggest
      </button>
      <MailComposer
        session={session}
        layout="inline"
        title="Compose"
        trailer=""
        placeholder="Message"
      />
    </>
  );
}
it('does not request a suggestion if a subject changed before the render committed', async () => {
  const post = jest.spyOn(mockOxy.http, 'post');
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <RealComposeHarness />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'edit subject then suggest' }));
  expect((screen.getByLabelText('subject') as HTMLInputElement).value).toBe('new subject');
  expect(post).not.toHaveBeenCalled();
  view.unmount();
  client.clear();
});
it('keeps a suggestion from replacing the subject after the body changes', async () => {
  jest.spyOn(mockOxy.http, 'post').mockResolvedValueOnce({
    schemaVersion: 1,
    requestId: 'req_01a06477',
    text: 'AI title',
  } as never);
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <RealComposeHarness />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'ai.toolbar.suggestSubject' }));
  await waitFor(() => expect(screen.getByText('AI title')).toBeTruthy());
  fireEvent.change(screen.getByLabelText('editor'), { target: { value: 'newer body' } });
  fireEvent.click(screen.getByRole('button', { name: 'ai.subjectSuggestion.apply' }));
  expect((screen.getByLabelText('subject') as HTMLInputElement).value).toBe('');
  expect(require('@oxy.so/bloom/toast').toast).toHaveBeenCalledWith(
    'ai.toast.subjectSuggestionStale',
  );
  fireEvent.click(screen.getByRole('button', { name: 'ai.subjectSuggestion.dismiss' }));
  expect(screen.queryByText('AI title')).toBeNull();
  view.unmount();
  client.clear();
});
it('does not apply an old suggestion if the subject was edited and cleared', async () => {
  jest.spyOn(mockOxy.http, 'post').mockResolvedValueOnce({
    schemaVersion: 1,
    requestId: 'req_01a06477',
    text: 'AI title',
  } as never);
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <RealComposeHarness />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'ai.toolbar.suggestSubject' }));
  await waitFor(() => expect(screen.getByText('AI title')).toBeTruthy());
  const subject = screen.getByLabelText('subject') as HTMLInputElement;
  fireEvent.change(subject, { target: { value: 'temporary' } });
  fireEvent.change(subject, { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'ai.subjectSuggestion.apply' }));
  expect(subject.value).toBe('');
  expect(screen.getByText('AI title')).toBeTruthy();
  expect(require('@oxy.so/bloom/toast').toast).toHaveBeenCalledWith(
    'ai.toast.subjectSuggestionStale',
  );
  view.unmount();
  client.clear();
});
it('hides a completed suggestion after an observed account transition', async () => {
  jest.spyOn(mockOxy.http, 'post').mockResolvedValueOnce({
    schemaVersion: 1,
    requestId: 'req_01a06477',
    text: 'AI title',
  } as never);
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <RealComposeHarness />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'ai.toolbar.suggestSubject' }));
  await waitFor(() => expect(screen.getByText('AI title')).toBeTruthy());
  act(() => {
    mockUser = 'bob';
    mockRuntime.setAccount({ id: 'bob' });
    view.rerender(
      <QueryClientProvider client={client}>
        <RealComposeHarness />
      </QueryClientProvider>,
    );
  });
  expect(screen.queryByText('AI title')).toBeNull();
  view.unmount();
  client.clear();
});
it('does not overwrite a subject typed while a suggestion is pending', async () => {
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
      <RealComposeHarness />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'ai.toolbar.suggestSubject' }));
  await waitFor(() => expect(mockOxy.http.post).toHaveBeenCalled());
  fireEvent.change(screen.getByLabelText('subject'), { target: { value: 'My own subject' } });
  await act(async () => {
    finish({ schemaVersion: 1, requestId: 'req_01a06477', text: 'AI title' });
    await response;
  });
  expect((screen.getByLabelText('subject') as HTMLInputElement).value).toBe('My own subject');
  expect(screen.getByText('AI title')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'ai.subjectSuggestion.apply' }));
  expect((screen.getByLabelText('subject') as HTMLInputElement).value).toBe('My own subject');
  expect(require('@oxy.so/bloom/toast').toast).toHaveBeenCalledWith(
    'ai.toast.subjectSuggestionStale',
  );
  view.unmount();
  client.clear();
});
it('does not apply a subject suggested under an earlier account', async () => {
  let finish!: (response: Response) => void;
  const response = new Promise<Response>((resolve) => {
    finish = resolve;
  });
  globalThis.fetch = jest.fn(() => response) as never;
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <RealComposeHarness />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'ai.toolbar.suggestSubject' }));
  await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
  act(() => {
    mockUser = 'bob';
    mockRuntime.batch(() => {
      mockRuntime.setAccount({ id: 'bob' });
      mockRuntime.setActiveSessionId('b-session');
    });
    view.rerender(
      <QueryClientProvider client={client}>
        <RealComposeHarness />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    finish({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ schemaVersion: 1, requestId: 'req_01a06477', text: 'AI title' }),
    } as unknown as Response);
    await response;
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect((screen.getByLabelText('subject') as HTMLInputElement).value).toBe('');
  expect(screen.queryByText('AI title')).toBeNull();
  view.unmount();
  client.clear();
});
it('shows the suggestion separately and requires applying it after the subject loses focus', async () => {
  jest.spyOn(mockOxy.http, 'post').mockResolvedValueOnce({
    schemaVersion: 1,
    requestId: 'req_01a06477',
    text: 'AI title',
  } as never);
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <RealComposeHarness />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'ai.toolbar.suggestSubject' }));
  await waitFor(() => expect(screen.getByText('AI title')).toBeTruthy());
  const subject = screen.getByLabelText('subject') as HTMLInputElement;
  expect(subject.value).toBe('');
  act(() => subject.focus());
  fireEvent.click(screen.getByRole('button', { name: 'ai.subjectSuggestion.apply' }));
  expect(subject.value).toBe('');
  expect(require('@oxy.so/bloom/toast').toast).toHaveBeenCalledWith(
    'ai.toast.subjectBlurBeforeApply',
  );
  expect(screen.getByText('AI title')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'ai.subjectSuggestion.apply' }));
  expect(subject.value).toBe('AI title');
  expect(screen.queryByText('AI title')).toBeNull();
  view.unmount();
  client.clear();
});
it('waits for a native-style end-editing value when blur carries no subject text', async () => {
  mockSubjectBlurWithoutText = true;
  jest.spyOn(mockOxy.http, 'post').mockResolvedValueOnce({
    schemaVersion: 1,
    requestId: 'req_01a06477',
    text: 'AI title',
  } as never);
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <RealComposeHarness />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'ai.toolbar.suggestSubject' }));
  await waitFor(() => expect(screen.getByText('AI title')).toBeTruthy());
  const subject = screen.getByLabelText('subject') as HTMLInputElement;
  act(() => subject.focus());
  fireEvent.click(screen.getByRole('button', { name: 'ai.subjectSuggestion.apply' }));
  fireEvent.click(screen.getByRole('button', { name: 'ai.subjectSuggestion.apply' }));
  expect(subject.value).toBe('');
  fireEvent.click(screen.getByRole('button', { name: 'finish subject editing' }));
  expect(subject.value).toBe('');
  fireEvent.click(screen.getByRole('button', { name: 'ai.subjectSuggestion.apply' }));
  expect(subject.value).toBe('');
  fireEvent.change(subject, { target: { value: 'IME final subject' } });
  fireEvent.click(screen.getByRole('button', { name: 'finish subject editing' }));
  expect(subject.value).toBe('IME final subject');
  fireEvent.click(screen.getByRole('button', { name: 'ai.subjectSuggestion.apply' }));
  expect(subject.value).toBe('IME final subject');
  expect(require('@oxy.so/bloom/toast').toast).toHaveBeenCalledWith(
    'ai.toast.subjectSuggestionStale',
  );
  view.unmount();
  client.clear();
});
it('does not apply while the new account input is focused after a retained old end-editing callback', async () => {
  jest.spyOn(mockOxy.http, 'post').mockResolvedValueOnce({
    schemaVersion: 1,
    requestId: 'req_01a06477',
    text: 'AI title',
  } as never);
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <RealComposeHarness />
    </QueryClientProvider>,
  );
  const subject = screen.getByLabelText('subject') as HTMLInputElement;
  act(() => subject.focus());
  const oldEndEditing = mockLatestSubjectEndEditing;
  expect(oldEndEditing).toBeDefined();
  act(() => {
    mockUser = 'bob';
    mockOxy.session.setAccessToken(token('bob', 'b-session'));
    mockRuntime.batch(() => {
      mockRuntime.setAccount({ id: 'bob' });
      mockRuntime.setActiveSessionId('b-session');
    });
    view.rerender(
      <QueryClientProvider client={client}>
        <RealComposeHarness />
      </QueryClientProvider>,
    );
  });
  fireEvent.click(screen.getByRole('button', { name: 'ai.toolbar.suggestSubject' }));
  await waitFor(() => expect(screen.getByText('AI title')).toBeTruthy());
  expect(document.activeElement).toBe(subject);
  act(() => oldEndEditing?.(''));
  subject.value = 'composition in progress';
  fireEvent.click(screen.getByRole('button', { name: 'ai.subjectSuggestion.apply' }));
  expect(subject.value).toBe('composition in progress');
  expect(screen.getByText('AI title')).toBeTruthy();
  expect(require('@oxy.so/bloom/toast').toast).toHaveBeenCalledWith(
    'ai.toast.subjectBlurBeforeApply',
  );
  view.unmount();
  client.clear();
});
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
it('does not show an aborted old preview after a committed user-only ABA', async () => {
  const stream = controlledStream();
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <ComposeHarness />
    </QueryClientProvider>,
  );
  beginDraft();
  await waitFor(() => expect(screen.getByText('first')).toBeTruthy());
  act(() => {
    mockUser = 'bob';
    view.rerender(
      <QueryClientProvider client={client}>
        <ComposeHarness />
      </QueryClientProvider>,
    );
  });
  expect(screen.queryByText('first')).toBeNull();
  act(() => {
    mockUser = 'alice';
    view.rerender(
      <QueryClientProvider client={client}>
        <ComposeHarness />
      </QueryClientProvider>,
    );
  });
  expect(screen.queryByText('first')).toBeNull();
  expect(
    (screen.getAllByRole('button', { name: 'ai.toolbar.draft' })[0] as HTMLButtonElement).disabled,
  ).toBe(false);
  await act(async () => {
    stream.finish();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect((screen.getByLabelText('editor') as HTMLTextAreaElement).value).toBe(
    'Original unsaved text',
  );
  view.unmount();
  client.clear();
});
it('uses the real session current text when an edit and polish start in the same batch', async () => {
  jest.spyOn(mockOxy.http, 'post').mockResolvedValueOnce({
    schemaVersion: 1,
    requestId: 'req_01a06477',
    text: 'Polished result',
  } as never);
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <RealComposeHarness />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'edit then polish' }));
  await waitFor(() => expect(mockOxy.http.post).toHaveBeenCalled());
  expect(jest.mocked(mockOxy.http.post).mock.calls[0][1]).toEqual({
    operation: 'polish',
    text: 'newer body',
  });
  view.unmount();
  client.clear();
});
it('Undo restores the real session edit made in the same batch as starting a stream', async () => {
  const stream = controlledStream();
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <RealComposeHarness />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText('ai.draftDialog.label'), { target: { value: 'prompt' } });
  fireEvent.click(screen.getByRole('button', { name: 'edit then draft' }));
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
  act(() => applied?.[1].action.onClick());
  expect((screen.getByLabelText('editor') as HTMLTextAreaElement).value).toBe('newer body');
  view.unmount();
  client.clear();
});
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
it('does not leave the next account toolbar blocked when the old rewrite ignores abort', async () => {
  let finish!: (value: { schemaVersion: number; requestId: string; text: string }) => void;
  const response = new Promise<{ schemaVersion: number; requestId: string; text: string }>(
    (resolve) => {
      finish = resolve;
    },
  );
  jest
    .spyOn(mockOxy.http, 'post')
    .mockReturnValueOnce(response as never)
    .mockResolvedValueOnce({
      schemaVersion: 1,
      requestId: 'req_01a06477',
      text: 'new account result',
    } as never);
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <ComposeHarness />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'ai.toolbar.polish' }));
  await waitFor(() => expect(mockOxy.http.post).toHaveBeenCalled());
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
  expect(
    (screen.getByRole('button', { name: 'ai.toolbar.polish' }) as HTMLButtonElement).disabled,
  ).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'ai.toolbar.polish' }));
  await waitFor(() =>
    expect((screen.getByLabelText('editor') as HTMLTextAreaElement).value).toBe(
      'new account result',
    ),
  );
  await act(async () => {
    finish({ schemaVersion: 1, requestId: 'req_01a06477', text: 'old' });
    await response;
  });
  expect((screen.getByLabelText('editor') as HTMLTextAreaElement).value).toBe('new account result');
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
