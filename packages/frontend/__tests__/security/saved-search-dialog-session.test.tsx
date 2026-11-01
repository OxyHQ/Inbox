import type { ReactNode } from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { OxyServices } from '@oxy.so/core';
import { useEmailStore } from '@/hooks/useEmail';
import { createInboxQueryClient, INBOX_ACCOUNT_QUERIES } from '@/hooks/queries/queryClient';

let mockOxy: OxyServices;
let mockSave: (() => void) | undefined;
let mockClose: (() => void) | undefined;
let mockChange: ((value: string) => void) | undefined;
let mockChip: (() => void) | undefined;
let mockRuntime: ReturnType<typeof import('@oxy.so/services/runtime').useOxyRuntime>;
jest.mock('@oxy.so/services/runtime', () => ({ useOxyRuntime: () => mockRuntime }));
jest.mock('@oxy.so/services/ui/client', () => ({
  useOxy: () => ({ user: { id: 'alice' }, oxyServices: mockOxy }),
}));
jest.mock('@oxy.so/bloom/toast', () => ({ toast: { error: jest.fn() } }));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native', () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock('@oxy.so/bloom/button', () => ({
  Button: ({ children, onPress }: { children: ReactNode; onPress: () => void }) => (
    <button type="button" onClick={onPress}>
      {children}
    </button>
  ),
}));
jest.mock('@oxy.so/bloom/chip', () => ({
  Chip: ({
    children,
    onPress,
    onClose,
    accessibilityLabel,
    closeLabel,
  }: {
    children: ReactNode;
    onPress: () => void;
    onClose?: () => void;
    accessibilityLabel: string;
    closeLabel: string;
  }) => {
    mockChip = onPress;
    return (
      <div>
        <button type="button" onClick={onPress} aria-label={accessibilityLabel}>
          {children}
        </button>
        {onClose && (
          <button type="button" onClick={onClose} aria-label={closeLabel}>
            x
          </button>
        )}
      </div>
    );
  },
}));
jest.mock('@oxy.so/bloom/dialog', () => ({
  Dialog: ({
    open,
    onClose,
    actions,
    children,
  }: {
    open: boolean;
    onClose: () => void;
    actions: {
      label: string;
      onPress?: () => void;
      disabled?: boolean;
      shouldCloseOnPress?: boolean;
    }[];
    children: ReactNode;
  }) => {
    if (open) {
      mockSave = actions.find((action) => action.label === 'common.save')?.onPress;
      mockClose = onClose;
    }
    return open ? (
      <div>
        {children}
        {actions.map((action) => (
          <button
            type="button"
            key={action.label}
            onClick={() => {
              action.onPress?.();
              if (action.shouldCloseOnPress !== false) onClose();
            }}
            disabled={action.disabled}
          >
            {action.label}
          </button>
        ))}
      </div>
    ) : null;
  },
}));
jest.mock('@oxy.so/bloom/text-field', () => ({
  TextFieldInput: ({
    value,
    onChangeText,
    label,
  }: {
    value: string;
    onChangeText: (value: string) => void;
    label: string;
  }) => {
    mockChange = onChangeText;
    return (
      <input
        aria-label={label}
        value={value}
        onChange={(event) => onChangeText(event.target.value)}
      />
    );
  },
}));
jest.mock('@oxy.so/bloom/typography', () => ({
  Text: ({
    children,
    accessibilityLiveRegion,
  }: {
    children: ReactNode;
    accessibilityLiveRegion?: string;
  }) => <span aria-live={accessibilityLiveRegion}>{children}</span>,
}));

import { SavedSearchBar } from '@/components/SavedSearchBar';
import { useNaturalLanguageSearch } from '@/hooks/queries/useNaturalLanguageSearch';
let mockOnApply: jest.Mock;
function Bar() {
  const { binding, isBindingCurrent } = useNaturalLanguageSearch();
  return (
    <SavedSearchBar
      scope={binding}
      isScopeCurrent={isBindingCurrent}
      query="query"
      filters={{}}
      enabled
      onApply={mockOnApply}
    />
  );
}

function token(session: string) {
  return `e30.${Buffer.from(JSON.stringify({ userId: 'alice', sessionId: session, exp: 2000000000 })).toString('base64url')}.fixture`;
}

const savedRow = {
  id: 'old',
  name: 'name-a',
  query: 'a',
  filters: {},
  order: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
async function setup(rows: unknown[] = []) {
  mockOnApply = jest.fn();
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
  jest.spyOn(mockOxy.http, 'get').mockResolvedValue(rows as never);
  const post = jest
    .spyOn(mockOxy.http, 'post')
    .mockResolvedValue({ ...savedRow, id: 'new' } as never);
  useEmailStore.getState()._initApi(mockOxy.http);
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
  const tree = () => (
    <QueryClientProvider client={client}>
      <Bar />
    </QueryClientProvider>
  );
  const view = render(tree());
  const change = (session: string) =>
    act(() => {
      mockOxy.session.setAccessToken(token(session));
      mockRuntime.setActiveSessionId(session);
      view.rerender(tree());
    });
  const open = () => fireEvent.click(view.getByRole('button', { name: 'search.ui.saveSearch' }));
  const type = (value: string) =>
    fireEvent.change(view.getByLabelText('search.ui.searchName'), { target: { value } });
  const cleanup = () => {
    view.unmount();
    persistence.detach();
    client.clear();
    useEmailStore.setState({ _api: null });
    mockOxy.dispose();
    jest.restoreAllMocks();
  };
  return { view, post, change, open, type, cleanup, client };
}

it('hides the pending A draft and blocks saving in B', async () => {
  const { view, post, change, open, type, cleanup } = await setup();
  open();
  type('private-a');
  change('session-b');
  expect(view.queryByDisplayValue('private-a')).toBeNull();
  expect(view.getByText('search.ui.savedDraftUnavailable').getAttribute('aria-live')).toBe(
    'polite',
  );
  expect((view.getByRole('button', { name: 'common.save' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  expect(post).not.toHaveBeenCalled();
  cleanup();
});

it('blocks retained A handlers after A to B to A without closing a new draft', async () => {
  const { view, post, change, open, type, cleanup } = await setup();
  open();
  type('private-a');
  const saveA = mockSave;
  const closeA = mockClose;
  const editA = mockChange;
  change('session-b');
  act(() => closeA?.());
  expect(view.getByText('search.ui.savedDraftUnavailable')).toBeTruthy();
  change('session-a');
  act(() => {
    saveA?.();
    editA?.('late-a');
  });
  expect(view.queryByDisplayValue('private-a')).toBeNull();
  expect(post).not.toHaveBeenCalled();
  fireEvent.click(view.getByRole('button', { name: 'common.close' }));
  open();
  type('new draft');
  act(() => {
    closeA?.();
    editA?.('late-a');
    saveA?.();
  });
  expect((view.getByLabelText('search.ui.searchName') as HTMLInputElement).value).toBe('new draft');
  expect(post).not.toHaveBeenCalled();
  cleanup();
});

it('keeps the normal save available for the same session', async () => {
  const { view, post, open, type, cleanup, client } = await setup();
  open();
  type('current');
  fireEvent.click(view.getByRole('button', { name: 'common.save' }));
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      '/email/saved-searches',
      expect.objectContaining({ name: 'current' }),
    ),
  );
  await waitFor(() => expect(client.isMutating()).toBe(0));
  expect(view.queryByLabelText('search.ui.searchName')).toBeNull();
  cleanup();
});

it('rejects a retained chip callback from an observed earlier session', async () => {
  const { view, change, cleanup } = await setup([savedRow]);
  await waitFor(() =>
    expect(view.getByRole('button', { name: 'search.ui.runSaved' })).toBeTruthy(),
  );
  const applyA = mockChip;
  change('session-b');
  act(() => applyA?.());
  expect(mockOnApply).not.toHaveBeenCalled();
  cleanup();
});

it('does not submit from a retained handler after unmount', async () => {
  const { post, open, type, cleanup } = await setup();
  open();
  type('private-a');
  const save = mockSave;
  cleanup();
  act(() => save?.());
  expect(post).not.toHaveBeenCalled();
});

it('keeps edits made while the same save is pending', async () => {
  const { view, post, open, type, cleanup, client } = await setup();
  let finish!: (value: unknown) => void;
  post.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  open();
  type('original');
  fireEvent.click(view.getByRole('button', { name: 'common.save' }));
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  type('newer draft');
  await act(async () => finish({ ...savedRow, name: 'original' }));
  await waitFor(() => expect(client.isMutating()).toBe(0));
  expect((view.getByLabelText('search.ui.searchName') as HTMLInputElement).value).toBe(
    'newer draft',
  );
  cleanup();
});

it('retains the name when the same session closes and reopens the dialog', async () => {
  const { view, open, type, cleanup } = await setup();
  open();
  type('draft');
  fireEvent.click(view.getByRole('button', { name: 'common.close' }));
  open();
  expect((view.getByLabelText('search.ui.searchName') as HTMLInputElement).value).toBe('draft');
  cleanup();
});
