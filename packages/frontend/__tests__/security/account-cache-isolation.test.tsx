/**
 * The mail cache stays strictly per account on Services 15, where Inbox owns
 * its React Query client and its account scoping (`inboxAccountCache`).
 *
 * This runs the app's own wiring: the module `queryClient`, the
 * `inboxAccountCache` it is scoped by, `followOxyRuntime`, and the real
 * `useLabels` / `useMessages` hooks behind `useAccountCacheReady`. Only the
 * session runtime (published, then every subscriber woken in one pass, as
 * Services' `createOxyRuntime` does), the per-account API and storage are fakes.
 *
 * `['labels']` is not keyed by account, so it is the root a leak would show
 * on. The story: A reads mail; a read for A is still in flight when the session
 * switches to B; A's late answer lands; B reads its own; sign-out; A signs in
 * again and gets its own cached mail back.
 */
import { act, render, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { __setOxyState, makeMockOxyServices } from '@oxy.so/services/ui/client';
import { accountQueryStorageKey } from '@/hooks/queries/accountQueryPersistence';
import { followOxyRuntime, inboxAccountCache } from '@/hooks/queries/inboxAccountCache';
import { queryClient } from '@/hooks/queries/queryClient';
import { useLabels } from '@/hooks/queries/useLabels';
import { useMessages } from '@/hooks/queries/useMessages';
import { useAccountCacheReady } from '@/hooks/useAccountCacheReady';
import { createRuntime, deferred, type FakeApi, memoryStorage } from '../fixtures/accountCache';

const mockApis = new Map<string, FakeApi>();
jest.mock('@oxy.so/bloom/toast', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/services/emailApi', () => ({
  createEmailApi: (http: { account: string }) => mockApis.get(http.account),
}));

const A_LABEL = { _id: 'label-a', name: 'A-private-label' };
const B_LABEL = { _id: 'label-b', name: 'B-own-label' };
const page = (subject: string) => ({
  data: [{ _id: `${subject}-id`, subject }],
  pagination: { hasMore: false, limit: 50, offset: 0, total: 1 },
});

function Probe() {
  const ready = useAccountCacheReady();
  const labels = useLabels();
  const messages = useMessages({ mailboxId: 'inbox' });
  const shown = [
    ...(labels.data ?? []).map((label) => label.name),
    ...(messages.data?.pages ?? []).flatMap((p) =>
      p.data.map((m) => (m as unknown as { subject: string }).subject),
    ),
  ];
  return (
    <span data-testid="probe" data-ready={String(ready)}>
      {shown.join('|')}
    </span>
  );
}

/** Everything the client holds right now, whatever key it sits under. */
const held = () =>
  JSON.stringify(
    queryClient
      .getQueryCache()
      .getAll()
      .map((query) => [query.queryKey, query.state.data]),
  );

it('never lets account A’s mail be read, rendered or persisted for B: switch, late answer, sign-out', async () => {
  const storage = memoryStorage();
  const runtime = createRuntime('A');
  const http = new Map<string, { account: string }>();
  const oxyFor = (id: string | null) => {
    if (id && !http.has(id)) http.set(id, { account: id });
    return {
      user: id ? { id } : null,
      isAuthenticated: id !== null,
      canUsePrivateApi: id !== null,
      oxyServices: { ...makeMockOxyServices(), http: id ? http.get(id) : {} } as never,
    };
  };
  // React hears the session first (its listener only schedules a render); the
  // cache's listener comes second and still runs before anything renders.
  runtime.subscribe(() => __setOxyState(oxyFor(runtime.getSnapshot().account?.id ?? null)));
  __setOxyState(oxyFor('A'));

  const aLabels = jest.fn().mockResolvedValue([A_LABEL]);
  mockApis.set('A', {
    listLabels: aLabels,
    listMessages: jest.fn().mockResolvedValue(page('A-private-subject')),
  });
  const unfollow = followOxyRuntime(inboxAccountCache, runtime, storage);

  const view = render(
    <QueryClientProvider client={queryClient}>
      <Probe />
    </QueryClientProvider>,
  );
  const probe = () => view.getByTestId('probe');

  // A reads its mail.
  await waitFor(() => expect(probe().textContent).toBe('A-private-label|A-private-subject'));

  // A read for A is still in flight when the session moves to B.
  const late = deferred<(typeof A_LABEL)[]>();
  aLabels.mockReturnValueOnce(late.promise);
  act(() => {
    // Not awaited: it settles only when the late answer does.
    void queryClient.invalidateQueries({ queryKey: ['labels'] });
  });
  await waitFor(() => expect(aLabels).toHaveBeenCalledTimes(2));

  const bLabels = deferred<(typeof B_LABEL)[]>();
  const bMessages = deferred<ReturnType<typeof page>>();
  mockApis.set('B', {
    listLabels: jest.fn(() => bLabels.promise),
    listMessages: jest.fn(() => bMessages.promise),
  });
  act(() => runtime.become('B'));

  // The first frame for B: nothing of A's is rendered or held, anywhere.
  expect(probe().textContent).toBe('');
  expect(held()).not.toContain('A-private');

  // A's late answer lands after the switch: it reaches neither the screen nor
  // B's cache.
  await act(async () => {
    late.resolve([{ ...A_LABEL, name: 'A-private-late-label' }]);
    await late.promise;
  });
  expect(probe().textContent).toBe('');
  expect(held()).not.toContain('A-private');
  expect(queryClient.getQueryData(['labels'])).toBeUndefined();

  // B reads its own.
  await waitFor(() => expect(probe().dataset.ready).toBe('true'));
  await act(async () => {
    bLabels.resolve([B_LABEL]);
    bMessages.resolve(page('B-own-subject'));
    await Promise.all([bLabels.promise, bMessages.promise]);
  });
  await waitFor(() => expect(probe().textContent).toBe('B-own-label|B-own-subject'));
  expect(held()).not.toContain('A-private');

  // B's blob is B's alone; A's blob (written as A was left) holds A's.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1_200));
  });
  const bBlob = storage.values.get(accountQueryStorageKey('B'));
  expect(bBlob).toContain('B-own-label');
  expect(bBlob).not.toContain('A-private');
  expect(storage.values.get(accountQueryStorageKey('A'))).toContain('A-private-label');
  expect(storage.values.get(accountQueryStorageKey('A'))).not.toContain('late');

  // Sign-out: nothing private on screen or in memory, and B's blob is deleted.
  act(() => runtime.become(null));
  expect(probe().textContent).toBe('');
  expect(held()).not.toContain('B-own');
  expect(held()).not.toContain('A-private');
  await waitFor(() => expect(storage.values.has(accountQueryStorageKey('B'))).toBe(false));

  // A signs in again, offline: its own cached mail is back from its own blob,
  // and nothing of B's.
  mockApis.set('A', {
    listLabels: jest.fn(() => new Promise<never>(() => undefined)),
    listMessages: jest.fn(() => new Promise<never>(() => undefined)),
  });
  act(() => runtime.become('A'));
  await waitFor(() => expect(probe().textContent).toBe('A-private-label|A-private-subject'));
  expect(held()).not.toContain('B-own');

  view.unmount();
  unfollow();
  queryClient.clear();
});
