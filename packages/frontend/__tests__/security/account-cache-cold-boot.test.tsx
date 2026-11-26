/**
 * A cold boot as B on a device that also holds A's persisted mail.
 *
 * Its own file, so the app's `queryClient` and `inboxAccountCache` start as
 * they do in a new process: nothing in memory, both accounts' blobs on disk.
 * B's first paint is B's own cached mail (offline: B's reads never answer),
 * and A's blob is neither hydrated nor touched.
 */
import { act, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { __setOxyState, makeMockOxyServices } from '@oxy.so/services/ui/client';
import { accountQueryStorageKey } from '@/hooks/queries/accountQueryPersistence';
import { followOxyRuntime, inboxAccountCache } from '@/hooks/queries/inboxAccountCache';
import { snapshot } from '@/hooks/queries/persistedQueryCache';
import { emailKeys } from '@/hooks/queries/queryKeys';
import { queryClient } from '@/hooks/queries/queryClient';
import { useLabels } from '@/hooks/queries/useLabels';
import { useMessages } from '@/hooks/queries/useMessages';
import { createRuntime, type FakeApi, memoryStorage } from '../fixtures/accountCache';

const mockApis = new Map<string, FakeApi>();
jest.mock('@oxy.so/bloom/toast', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/services/emailApi', () => ({
  createEmailApi: (http: { account: string }) => mockApis.get(http.account),
}));

/** A blob exactly as the account cache writes one, for `account`'s mail. */
function blobFor(account: string, marker: string): string {
  const seed = new QueryClient();
  seed.setQueryData(emailKeys.labels, [{ _id: `label-${account}`, name: `${marker}-label` }]);
  seed.setQueryData(emailKeys.messages.list({ mailboxId: 'inbox', userId: account }), {
    pages: [
      {
        data: [{ _id: `${marker}-id`, subject: `${marker}-subject` }],
        pagination: { hasMore: false, limit: 50, offset: 0, total: 1 },
      },
    ],
    pageParams: [''],
  });
  seed.setQueryData(emailKeys.thread.detail('shared-thread'), { subject: `${marker}-thread` });
  const blob = snapshot(seed, {
    persistsQuery: () => true,
    shouldDehydrateMutation: () => false,
  });
  seed.clear();
  return blob;
}

function Probe() {
  const labels = useLabels();
  const messages = useMessages({ mailboxId: 'inbox' });
  const shown = [
    ...(labels.data ?? []).map((label) => label.name),
    ...(messages.data?.pages ?? []).flatMap((p) =>
      p.data.map((m) => (m as unknown as { subject: string }).subject),
    ),
  ];
  return <span data-testid="probe">{shown.join('|')}</span>;
}

it('boots as B with A’s persisted mail on the device: B paints its own cache, never A’s', async () => {
  const aBlob = blobFor('A', 'A-private');
  const storage = memoryStorage({
    [accountQueryStorageKey('A')]: aBlob,
    [accountQueryStorageKey('B')]: blobFor('B', 'B-own'),
  });
  // Offline: B's reads never answer, so whatever B sees came from disk.
  const never = () => new Promise<never>(() => undefined);
  mockApis.set('B', { listLabels: jest.fn(never), listMessages: jest.fn(never) });
  const runtime = createRuntime('B');
  __setOxyState({
    user: { id: 'B' },
    isAuthenticated: true,
    canUsePrivateApi: true,
    oxyServices: { ...makeMockOxyServices(), http: { account: 'B' } } as never,
  });

  const unfollow = followOxyRuntime(inboxAccountCache, runtime, storage);
  const view = render(
    <QueryClientProvider client={queryClient}>
      <Probe />
    </QueryClientProvider>,
  );
  const probe = () => view.getByTestId('probe');

  // Before B's blob is read, nothing private renders.
  expect(probe().textContent).toBe('');

  await waitFor(() => expect(probe().textContent).toBe('B-own-label|B-own-subject'));
  const held = JSON.stringify(
    queryClient
      .getQueryCache()
      .getAll()
      .map((query) => query.state.data),
  );
  expect(held).toContain('B-own-thread');
  expect(held).not.toContain('A-private');
  expect(queryClient.getQueryData(emailKeys.thread.detail('shared-thread'))).toEqual({
    subject: 'B-own-thread',
  });

  // A's blob was never read into memory nor rewritten.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1_200));
  });
  expect(storage.values.get(accountQueryStorageKey('A'))).toBe(aBlob);
  expect(storage.values.get(accountQueryStorageKey('B'))).not.toContain('A-private');

  view.unmount();
  unfollow();
  queryClient.clear();
});
