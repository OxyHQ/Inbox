import { useState, type ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { OxyServices } from '@oxy.so/core';
import { createInboxQueryClient } from '@/hooks/queries/queryClient';
import { useEmailStore } from '@/hooks/useEmail';

let mockOxy: OxyServices;
let mockUser = 'alice';
let mockRuntime: ReturnType<typeof import('@oxy.so/services/runtime').useOxyRuntime>;
jest.mock('@oxy.so/services/runtime', () => ({ useOxyRuntime: () => mockRuntime }));
jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({ oxyServices: mockOxy, user: { id: mockUser } }),
}));
const mockToast = { error: jest.fn() };
jest.mock('@oxy.so/bloom/toast', () => ({ toast: mockToast }));
jest.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'en' }),
}));
jest.mock('react-native', () => ({ View: ({ children }: { children: ReactNode }) => children }));
jest.mock('@oxy.so/bloom/typography', () => ({
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
jest.mock('@oxy.so/bloom/bottom-sheet', () => {
  const React = require('react');
  return {
    BottomSheet: React.forwardRef(({ children }: { children: ReactNode }, ref: unknown) => {
      React.useImperativeHandle(ref, () => ({ present: () => {}, dismiss: () => {} }));
      return <div>{children}</div>;
    }),
  };
});
jest.mock('@oxy.so/bloom/button', () => ({
  Button: ({
    children,
    onPress,
    disabled,
  }: {
    children: ReactNode;
    onPress: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" disabled={disabled} onClick={onPress}>
      {children}
    </button>
  ),
  IconButton: ({
    accessibilityLabel,
    onPress,
  }: {
    accessibilityLabel: string;
    onPress: () => void;
  }) => <button type="button" aria-label={accessibilityLabel} onClick={onPress} />,
}));
jest.mock('@oxy.so/bloom/text-field', () => ({
  TextFieldInput: ({
    label,
    value,
    onChangeText,
    editable = true,
  }: {
    label: string;
    value: string;
    onChangeText: (value: string) => void;
    editable?: boolean;
  }) => (
    <input
      aria-label={label}
      value={value}
      disabled={!editable}
      onChange={(e) => onChangeText(e.target.value)}
    />
  ),
}));
import { CreateReminderSheet } from '@/components/CreateReminderSheet';
import { useCreateReminder, useUpdateReminder } from '@/hooks/mutations/useReminderMutations';
import { isCurrentEmailOwner, useEmailMutationOwner } from '@/hooks/mutations/ownedEmailMutation';
function token() {
  return `e30.${Buffer.from(JSON.stringify({ userId: 'alice', sessionId: 'a-session', exp: 2000000000 })).toString('base64url')}.fixture`;
}
function Harness({ edit = false }: { edit?: boolean }) {
  const owner = useEmailMutationOwner(true);
  const create = useCreateReminder();
  const update = useUpdateReminder();
  const [target, setTarget] = useState(
    () =>
      ({ owner, create: create.mutateAsync, update: update.mutateAsync }) as {
        owner: typeof owner;
        create: typeof create.mutateAsync;
        update: typeof update.mutateAsync;
      } | null,
  );
  const save = async (text: string, remindAt: Date) => {
    const captured = target;
    if (!captured || !isCurrentEmailOwner(captured.owner))
      throw new Error('Reminder session changed');
    if (edit)
      await captured.update({ reminderId: 'synthetic', text, remindAt: remindAt.toISOString() });
    else
      await captured.create({
        text,
        remindAt: remindAt.toISOString(),
        relatedMessageId: 'synthetic-message',
      });
    setTarget((current) => (current === captured ? null : current));
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setTarget({ owner, create: create.mutateAsync, update: update.mutateAsync })}
      >
        reopen
      </button>
      <CreateReminderSheet
        key={target ? 'open' : 'closed'}
        visible={target !== null}
        onClose={() => setTarget((current) => (current === target ? null : current))}
        onCreate={save}
        onUpdate={save}
        unavailableMessage={
          target && !isCurrentEmailOwner(target.owner) ? 'unavailable' : undefined
        }
        editReminder={
          edit ? { _id: 'synthetic', text: 'Original', remindAt: '2030-01-01T09:00:00.000Z' } : null
        }
      />
    </>
  );
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
  mockOxy.session.setAccessToken(token());
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
    mockRuntime.setActiveSessionId('a-session');
  });
  useEmailStore.getState()._initApi(mockOxy.http);
  globalThis.fetch = jest.fn(async () => {
    throw new Error('synthetic offline');
  }) as never;
});
afterEach(() => {
  useEmailStore.getState().resetAccountScopedState();
  mockOxy.dispose();
  globalThis.fetch = previousFetch;
});
it.each([false, true])(
  'retains user text after a failed reminder write (edit=%s)',
  async (edit) => {
    const client = createInboxQueryClient();
    const view = render(
      <QueryClientProvider client={client}>
        <Harness edit={edit} />
      </QueryClientProvider>,
    );
    const input = screen.getByLabelText('reminder.create.placeholder') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Synthetic unsaved text' } });
    if (!edit) {
      const preset = screen
        .getAllByRole('button')
        .find((button) => button.textContent?.startsWith('reminder.create.presets.'));
      if (!preset) throw new Error('Expected preset');
      fireEvent.click(preset);
    }
    fireEvent.click(
      screen.getByRole('button', { name: edit ? 'common.save' : 'reminder.create.submit' }),
    );
    await waitFor(() => expect(mockToast.error).toHaveBeenCalled());
    expect((screen.getByLabelText('reminder.create.placeholder') as HTMLInputElement).value).toBe(
      'Synthetic unsaved text',
    );
    view.unmount();
    client.clear();
  },
);

it('does not submit an open A draft using a later same-subject session', async () => {
  const sent: string[] = [];
  globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    sent.push(new Headers(init?.headers).get('authorization') ?? '');
    throw new Error('synthetic failure');
  }) as never;
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText('reminder.create.placeholder'), {
    target: { value: 'Synthetic private draft' },
  });
  const preset = screen
    .getAllByRole('button')
    .find((button) => button.textContent?.startsWith('reminder.create.presets.'));
  if (!preset) throw new Error('Expected preset');
  fireEvent.click(preset);
  const changed = `e30.${Buffer.from(JSON.stringify({ userId: 'alice', sessionId: 'new-session', exp: 2000000000 })).toString('base64url')}.fixture`;
  act(() => {
    mockOxy.session.setAccessToken(changed);
    mockRuntime.setActiveSessionId('new-session');
  });
  view.rerender(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  );
  expect(
    (screen.getByRole('button', { name: 'reminder.create.submit' }) as HTMLButtonElement).disabled,
  ).toBe(true);
  expect(screen.getByText('unavailable')).toBeTruthy();
  expect(sent).toEqual([]);
  expect((screen.getByLabelText('reminder.create.placeholder') as HTMLInputElement).value).toBe(
    'Synthetic private draft',
  );
  view.unmount();
  client.clear();
});

it.each([false, true])(
  'closing during save leaves a reopened draft untouched by late success (edit=%s)',
  async (edit) => {
    let release!: (value: unknown) => void;
    const reply = new Promise<unknown>((resolve) => {
      release = resolve;
    });
    globalThis.fetch = jest.fn(async () => reply) as never;
    const client = createInboxQueryClient();
    const view = render(
      <QueryClientProvider client={client}>
        <Harness edit={edit} />
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByLabelText('reminder.create.placeholder'), {
      target: { value: 'First draft' },
    });
    if (!edit) {
      const preset = screen
        .getAllByRole('button')
        .find((button) => button.textContent?.startsWith('reminder.create.presets.'));
      if (!preset) throw new Error('Expected preset');
      fireEvent.click(preset);
    }
    fireEvent.click(
      screen.getByRole('button', { name: edit ? 'common.save' : 'reminder.create.submit' }),
    );
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
    expect(screen.getByText('ui.mutations.reminderPendingNotice')).toBeTruthy();
    expect(
      (screen.getByLabelText('reminder.create.placeholder') as HTMLInputElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'common.close' }));
    fireEvent.click(screen.getByRole('button', { name: 'reopen' }));
    fireEvent.change(screen.getByLabelText('reminder.create.placeholder'), {
      target: { value: 'Second draft' },
    });
    const at = '2030-01-01T00:00:00.000Z';
    const body = {
      data: {
        _id: 'synthetic',
        userId: 'alice',
        text: 'First draft',
        remindAt: at,
        completed: false,
        pinned: false,
        createdAt: at,
        updatedAt: at,
      },
    };
    await act(async () =>
      release({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: () => 'application/json' },
        json: async () => body,
        text: async () => JSON.stringify(body),
        clone() {
          return this;
        },
      }),
    );
    await waitFor(() =>
      expect(client.getMutationCache().getAll().at(-1)?.state.status).toBe('success'),
    );
    expect((screen.getByLabelText('reminder.create.placeholder') as HTMLInputElement).value).toBe(
      'Second draft',
    );
    view.unmount();
    client.clear();
  },
);
it('keeps B editor separate when A changes account while a save is in flight', async () => {
  let release!: (value: unknown) => void, begin!: () => void;
  const pending = new Promise<unknown>((r) => {
    release = r;
  });
  const started = new Promise<void>((r) => {
    begin = r;
  });
  globalThis.fetch = jest.fn(async () => {
    begin();
    return pending;
  }) as never;
  const client = createInboxQueryClient();
  const content = () => (
    <QueryClientProvider client={client}>
      <Harness key={mockUser} />
    </QueryClientProvider>
  );
  const view = render(content());
  fireEvent.change(screen.getByLabelText('reminder.create.placeholder'), {
    target: { value: 'Private A' },
  });
  const preset = screen
    .getAllByRole('button')
    .find((button) => button.textContent?.startsWith('reminder.create.presets.'));
  if (!preset) throw new Error('Expected preset');
  fireEvent.click(preset);
  fireEvent.click(screen.getByRole('button', { name: 'reminder.create.submit' }));
  await started;
  const mutation = client.getMutationCache().getAll().at(-1);
  if (!mutation) throw new Error('Expected mutation');
  const next = `e30.${Buffer.from(JSON.stringify({ userId: 'bob', sessionId: 'b-session', exp: 2000000000 })).toString('base64url')}.fixture`;
  act(() => {
    mockUser = 'bob';
    mockOxy.session.setAccessToken(next);
    mockRuntime.batch(() => {
      mockRuntime.setAccount({ id: 'bob' });
      mockRuntime.setActiveSessionId('b-session');
    });
    useEmailStore.getState().resetAccountScopedState();
    useEmailStore.getState()._initApi(mockOxy.http);
    view.rerender(content());
  });
  expect((screen.getByLabelText('reminder.create.placeholder') as HTMLInputElement).value).toBe('');
  fireEvent.change(screen.getByLabelText('reminder.create.placeholder'), {
    target: { value: 'Private B' },
  });
  const at = '2030-01-01T00:00:00.000Z';
  const body = {
    data: {
      _id: 'synthetic',
      userId: 'alice',
      text: 'Private A',
      remindAt: at,
      completed: false,
      pinned: false,
      createdAt: at,
      updatedAt: at,
    },
  };
  await act(async () =>
    release({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => 'application/json' },
      json: async () => body,
      text: async () => JSON.stringify(body),
      clone() {
        return this;
      },
    }),
  );
  await waitFor(() => expect(mutation.state.status).not.toBe('pending'));
  expect((screen.getByLabelText('reminder.create.placeholder') as HTMLInputElement).value).toBe(
    'Private B',
  );
  expect(mockToast.error).not.toHaveBeenCalled();
  view.unmount();
  client.clear();
});
it('does not start two creates from synchronous submit events', async () => {
  let release!: (value: unknown) => void;
  const pending = new Promise<unknown>((r) => {
    release = r;
  });
  globalThis.fetch = jest.fn(async () => pending) as never;
  const client = createInboxQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText('reminder.create.placeholder'), {
    target: { value: 'Synthetic' },
  });
  const preset = screen
    .getAllByRole('button')
    .find((button) => button.textContent?.startsWith('reminder.create.presets.'));
  if (!preset) throw new Error('Expected preset');
  fireEvent.click(preset);
  const submit = screen.getByRole('button', { name: 'reminder.create.submit' });
  act(() => {
    submit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    submit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
  const at = '2030-01-01T00:00:00.000Z';
  const body = {
    data: {
      _id: 'synthetic',
      userId: 'alice',
      text: 'Synthetic',
      remindAt: at,
      completed: false,
      pinned: false,
      createdAt: at,
      updatedAt: at,
    },
  };
  await act(async () =>
    release({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => 'application/json' },
      json: async () => body,
      text: async () => JSON.stringify(body),
      clone() {
        return this;
      },
    }),
  );
  await waitFor(() =>
    expect(client.getMutationCache().getAll().at(-1)?.state.status).toBe('success'),
  );
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  view.unmount();
  client.clear();
});
it.each([false, true])(
  'retries a failed save manually with the retained text (edit=%s)',
  async (edit) => {
    const at = '2030-01-01T00:00:00.000Z';
    const body = {
      data: {
        _id: 'synthetic',
        userId: 'alice',
        text: 'Retained',
        remindAt: at,
        completed: false,
        pinned: false,
        createdAt: at,
        updatedAt: at,
      },
    };
    globalThis.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error('synthetic offline'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: () => 'application/json' },
        json: async () => body,
        text: async () => JSON.stringify(body),
        clone() {
          return this;
        },
      }) as never;
    const client = createInboxQueryClient();
    const view = render(
      <QueryClientProvider client={client}>
        <Harness edit={edit} />
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByLabelText('reminder.create.placeholder'), {
      target: { value: 'Retained' },
    });
    if (!edit) {
      const preset = screen
        .getAllByRole('button')
        .find((button) => button.textContent?.startsWith('reminder.create.presets.'));
      if (!preset) throw new Error('Expected preset');
      fireEvent.click(preset);
    }
    const buttonName = edit ? 'common.save' : 'reminder.create.submit';
    fireEvent.click(screen.getByRole('button', { name: buttonName }));
    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith('ui.mutations.reminderSaveUnconfirmed'),
    );
    await waitFor(() =>
      expect((screen.getByRole('button', { name: buttonName }) as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );
    expect((screen.getByLabelText('reminder.create.placeholder') as HTMLInputElement).value).toBe(
      'Retained',
    );
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: buttonName }));
    await waitFor(() =>
      expect(client.getMutationCache().getAll().at(-1)?.state.status).toBe('success'),
    );
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    view.unmount();
    client.clear();
  },
);
