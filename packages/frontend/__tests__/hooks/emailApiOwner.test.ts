import { useEmailStore } from '@/hooks/useEmail';
import { dirname, join } from 'node:path';
import { dehydrate, onlineManager, QueryClient } from '@tanstack/react-query';
import {
  INBOX_ACCOUNT_QUERIES,
  INBOX_MUTATION_KEYS,
  queryClient,
  resumeInboxMutations,
} from '@/hooks/queries/queryClient';
import { waitFor } from '@testing-library/react';
import { wireMessage } from '../fixtures/wire';

const sdkDirectory = dirname(require.resolve('@oxy.so/services/package.json'));
const { createAccountQueryPersistence } = require(
  join(sdkDirectory, 'lib/commonjs/ui/hooks/accountQueryPersistence.js'),
);

afterEach(() => {
  useEmailStore.getState().resetAccountScopedState();
  onlineManager.setOnline(true);
  queryClient.clear();
});

it('uses the current HTTP client when a provider replaces it', async () => {
  const first = { get: jest.fn().mockResolvedValue([]) };
  const second = { get: jest.fn().mockResolvedValue([]) };

  const originalApi = useEmailStore.getState()._initApi(first as never);
  expect(useEmailStore.getState()._initApi(first as never)).toBe(originalApi);
  const currentApi = useEmailStore.getState()._initApi(second as never);
  expect(currentApi).not.toBe(originalApi);
  expect(useEmailStore.getState()._api).toBe(currentApi);
  await currentApi.listLabels();

  expect(first.get).not.toHaveBeenCalled();
  expect(second.get).toHaveBeenCalledWith('/email/labels');
});

it('creates a new API after account state is reset, even for the same HTTP client', () => {
  const http = { get: jest.fn() };
  const first = useEmailStore.getState()._initApi(http as never);
  useEmailStore.getState().resetAccountScopedState();
  expect(useEmailStore.getState()._initApi(http as never)).not.toBe(first);
});

it('resumes an account-ready paused operation only once when HTTP changes', async () => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const execute = jest.fn(() => pending);
  const mutation = queryClient.getMutationCache().build(queryClient, { mutationFn: execute });
  mutation.state = { ...mutation.state, status: 'pending', isPaused: true, variables: undefined };
  const first = { get: jest.fn() };
  const second = { get: jest.fn() };
  useEmailStore.getState()._initApi(first as never);
  useEmailStore.getState()._initApi(second as never);
  useEmailStore.getState()._initApi(second as never);
  await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
  finish();
  await waitFor(() => expect(mutation.state.status).toBe('success'));
  expect(execute).toHaveBeenCalledTimes(1);
});

it('does not resume paused work without an active account API', async () => {
  const execute = jest.fn().mockResolvedValue(undefined);
  const mutation = queryClient.getMutationCache().build(queryClient, { mutationFn: execute });
  mutation.state = { ...mutation.state, status: 'pending', isPaused: true, variables: undefined };
  useEmailStore.getState().resetAccountScopedState();
  resumeInboxMutations();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(execute).not.toHaveBeenCalled();
  expect(mutation.state.isPaused).toBe(true);
});

it('waits for the next account cache before resuming only that account’s work', async () => {
  onlineManager.setOnline(false);
  const accountBlob = (messageId: string) => {
    const seed = new QueryClient();
    const pending = seed.getMutationCache().build(seed, {
      mutationKey: INBOX_MUTATION_KEYS.toggleStar,
      mutationFn: async () => undefined,
    });
    pending.state = {
      ...pending.state,
      status: 'pending',
      isPaused: true,
      variables: { messageId, starred: true },
    };
    return JSON.stringify({
      buster: 'audit',
      timestamp: Date.now(),
      clientState: dehydrate(seed, { shouldDehydrateMutation: () => true }),
    });
  };
  const entries = new Map([
    ['oxy_account_queries:alice', accountBlob('alice-message')],
    ['oxy_account_queries:bob', accountBlob('bob-message')],
  ]);
  const storage = {
    getItem: async (key: string) => entries.get(key) ?? null,
    setItem: async (key: string, value: string) => void entries.set(key, value),
    removeItem: async (key: string) => void entries.delete(key),
  };
  const persistence = createAccountQueryPersistence(queryClient, INBOX_ACCOUNT_QUERIES);
  persistence.setStorage(storage);
  persistence.attach();
  const alice = { put: jest.fn().mockResolvedValue(wireMessage()) };
  const bob = { put: jest.fn().mockResolvedValue(wireMessage()) };
  try {
    persistence.activate('alice');
    await persistence.whenReady();
    useEmailStore.getState()._initApi(alice as never);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(alice.put).not.toHaveBeenCalled();

    useEmailStore.getState().resetAccountScopedState();
    persistence.activate('bob');
    await persistence.whenReady();
    expect(
      queryClient
        .getMutationCache()
        .getAll()
        .map((m) => m.state.variables),
    ).toEqual([{ messageId: 'bob-message', starred: true }]);
    onlineManager.setOnline(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(bob.put).not.toHaveBeenCalled();
    useEmailStore.getState()._initApi(bob as never);
    await waitFor(() => expect(bob.put).toHaveBeenCalledTimes(1));
    expect(bob.put).toHaveBeenCalledWith('/email/messages/bob-message/flags', {
      flags: { starred: true },
    });
    expect(alice.put).not.toHaveBeenCalled();
  } finally {
    persistence.detach();
  }
});
