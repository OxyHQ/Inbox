/**
 * Settings-side mutations: each failure is reported once, a label name clash
 * says so, and a change the server rewrites onto mail (a label rename or
 * delete, a folder delete that moves its messages to Archive) reconciles every
 * view that shows mail — not only its own list.
 */

const api = {
  createLabel: jest.fn(),
  updateLabel: jest.fn(),
  deleteLabel: jest.fn(),
  deleteMailbox: jest.fn(),
  unsubscribe: jest.fn(),
  listContacts: jest.fn(),
  deleteContact: jest.fn(),
};
jest.mock('@/hooks/useEmail', () => ({
  useEmailStore: (selector: (s: unknown) => unknown) => selector({ _api: api }),
}));

const toast = { error: jest.fn(), success: jest.fn(), info: jest.fn() };
jest.mock('@oxy.so/bloom', () => ({ toast }));

jest.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) => (vars ? `${key}:${JSON.stringify(vars)}` : key),
  }),
}));

import { type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, type InfiniteData } from '@tanstack/react-query';

import { useDeleteMailbox } from '@/hooks/mutations/useMailboxMutations';
import { markUnsubscribed, useUnsubscribe } from '@/hooks/mutations/useUnsubscribe';
import { useDeleteContact } from '@/hooks/mutations/useContactMutations';
import { emailKeys } from '@/hooks/queries/queryKeys';
import { nextContactsOffset, useContacts, type ContactsPage } from '@/hooks/queries/useContacts';
import { isLabelNameTaken, useCreateLabel, useDeleteLabel, useUpdateLabel } from '@/hooks/queries/useLabels';
import type { Contact, Label, Subscription } from '@/services/emailApi';
import { httpStatus } from '@/utils/httpStatus';

function conflict(): Error {
  return Object.assign(new Error('Label "Work" already exists'), { status: 409 });
}

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  const invalidatedRoots = () =>
    invalidate.mock.calls.map(([filters]) => (filters as { queryKey?: readonly unknown[] })?.queryKey?.[0]);
  return { queryClient, invalidate, invalidatedRoots, wrapper: Wrapper };
}

const MAIL_VIEW_ROOTS = ['messages', 'message', 'thread', 'search', 'bundles', 'mailboxes'];

beforeEach(() => jest.clearAllMocks());

describe('labels', () => {
  const labels = [
    { _id: 'a', name: 'Work' },
    { _id: 'b', name: 'Receipts' },
  ] as Label[];

  it('treats names as the server does: case-insensitively, ignoring the label being renamed', () => {
    expect(isLabelNameTaken(labels, ' work ')).toBe(true);
    expect(isLabelNameTaken(labels, 'Travel')).toBe(false);
    // Renaming "Work" to "WORK" is not a clash with itself.
    expect(isLabelNameTaken(labels, 'WORK', 'a')).toBe(false);
    expect(isLabelNameTaken(labels, 'receipts', 'a')).toBe(true);
  });

  it('says the name is taken on a 409, in exactly one toast', async () => {
    api.updateLabel.mockRejectedValue(conflict());
    const { wrapper } = setup();
    const { result } = renderHook(() => useUpdateLabel(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ labelId: 'a', updates: { name: 'Receipts' } }).catch(() => undefined);
    });
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith('ui.mutations.labelNameTaken:{"name":"Receipts"}');
  });

  it('keeps the generic message for any other create failure', async () => {
    api.createLabel.mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }));
    const { wrapper } = setup();
    const { result } = renderHook(() => useCreateLabel(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ name: 'Travel', color: '#000' }).catch(() => undefined);
    });
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith('ui.mutations.labelCreateFailed');
  });

  it('reports a create clash as a clash', async () => {
    api.createLabel.mockRejectedValue(conflict());
    const { wrapper } = setup();
    const { result } = renderHook(() => useCreateLabel(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ name: 'work', color: '#000' }).catch(() => undefined);
    });
    expect(toast.error).toHaveBeenCalledWith('ui.mutations.labelNameTaken:{"name":"work"}');
  });

  it('reconciles every view that shows mail after a rename', async () => {
    api.updateLabel.mockResolvedValue({ _id: 'a', name: 'Job' });
    const { wrapper, invalidatedRoots } = setup();
    const { result } = renderHook(() => useUpdateLabel(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ labelId: 'a', updates: { name: 'Job' } });
    });
    expect(invalidatedRoots()).toEqual(expect.arrayContaining(['labels', ...MAIL_VIEW_ROOTS]));
  });

  it('reconciles every view that shows mail after a delete', async () => {
    api.deleteLabel.mockResolvedValue(undefined);
    const { wrapper, invalidatedRoots } = setup();
    const { result } = renderHook(() => useDeleteLabel(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync('a');
    });
    expect(invalidatedRoots()).toEqual(expect.arrayContaining(['labels', ...MAIL_VIEW_ROOTS]));
  });
});

describe('folders', () => {
  it('reconciles every view that shows mail when a folder is deleted, since its mail moves to Archive', async () => {
    api.deleteMailbox.mockResolvedValue(undefined);
    const { wrapper, invalidatedRoots } = setup();
    const { result } = renderHook(() => useDeleteMailbox(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ mailboxId: 'folder-1' });
    });
    expect(invalidatedRoots()).toEqual(expect.arrayContaining(MAIL_VIEW_ROOTS));
  });
});

describe('subscriptions', () => {
  const sub = (id: string): Subscription =>
    ({ _id: id, name: id, messageCount: 3, readCount: 0, hasListUnsubscribe: true, type: 'list-unsubscribe' }) as Subscription;
  type Cache = InfiniteData<{ data: Subscription[]; pagination: unknown }>;
  const seed = (): Cache => ({
    pages: [{ data: [sub('news@a.com'), sub('promo@b.com')], pagination: { total: 2, limit: 30, offset: 0, hasMore: false } }],
    pageParams: [0],
  });

  it('marks the row unsubscribed instead of removing it', () => {
    const next = markUnsubscribed(seed() as never, 'news@a.com', '2026-10-10T00:00:00.000Z');
    expect(next.pages[0].data).toHaveLength(2);
    expect(next.pages[0].data[0]).toMatchObject({ unsubscribed: true, unsubscribedAt: '2026-10-10T00:00:00.000Z' });
    expect(next.pages[0].data[1].unsubscribed).toBeUndefined();
  });

  it('keeps the row marked after success instead of refetching it back to "subscribed"', async () => {
    api.unsubscribe.mockResolvedValue({ success: true, method: 'one-click' });
    const { queryClient, wrapper, invalidate } = setup();
    queryClient.setQueryData(emailKeys.subscriptions, seed());
    const { result } = renderHook(() => useUnsubscribe(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ senderAddress: 'news@a.com', method: 'list-unsubscribe' });
    });
    const cache = queryClient.getQueryData<Cache>(emailKeys.subscriptions)!;
    expect(cache.pages[0].data.map((s) => [s._id, s.unsubscribed ?? false])).toEqual([
      ['news@a.com', true],
      ['promo@b.com', false],
    ]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: emailKeys.subscriptions, refetchType: 'none' });
  });

  it('restores the row when the unsubscribe fails', async () => {
    api.unsubscribe.mockRejectedValue(new Error('nope'));
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(emailKeys.subscriptions, seed());
    const { result } = renderHook(() => useUnsubscribe(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ senderAddress: 'news@a.com' }).catch(() => undefined);
    });
    const cache = queryClient.getQueryData<Cache>(emailKeys.subscriptions)!;
    expect(cache.pages[0].data[0].unsubscribed).toBeUndefined();
    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});

describe('contacts', () => {
  const contact = (i: number) => ({ _id: `c${i}`, name: `C ${i}`, email: `c${i}@x.com` }) as Contact;
  const page = (offset: number, count: number, total: number): ContactsPage => ({
    data: Array.from({ length: count }, (_, i) => contact(offset + i)),
    pagination: { total, limit: 100, offset, hasMore: offset + 100 < total },
  });

  it('pages on, and stops at the end or at an empty page', () => {
    expect(nextContactsOffset(page(0, 100, 250))).toBe(100);
    expect(nextContactsOffset(page(200, 50, 250))).toBeUndefined();
    expect(nextContactsOffset({ data: [], pagination: { total: 9, limit: 100, offset: 0, hasMore: true } })).toBeUndefined();
  });

  it('reads past the API\'s 100-row cap one page at a time', async () => {
    api.listContacts.mockImplementation(({ offset }: { offset: number }) => Promise.resolve(page(offset, offset === 0 ? 100 : 50, 150)));
    const { wrapper } = setup();
    const { result } = renderHook(() => useContacts(), { wrapper });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    expect(api.listContacts).toHaveBeenLastCalledWith({ q: undefined, limit: 100, offset: 0 });
    await act(async () => {
      await result.current.fetchNextPage();
    });
    expect(api.listContacts).toHaveBeenLastCalledWith({ q: undefined, limit: 100, offset: 100 });
    await waitFor(() => expect(result.current.data!.pages.flatMap((p) => p.data)).toHaveLength(150));
    expect(result.current.hasNextPage).toBe(false);
  });

  it('applies an optimistic delete to the paged cache', async () => {
    api.deleteContact.mockReturnValue(new Promise(() => undefined));
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(emailKeys.contacts.list(undefined), { pages: [page(0, 3, 3)], pageParams: [0] });
    const { result } = renderHook(() => useDeleteContact(), { wrapper });
    act(() => {
      result.current.mutate('c1');
    });
    await waitFor(() => {
      const cache = queryClient.getQueryData<InfiniteData<ContactsPage>>(emailKeys.contacts.list(undefined))!;
      expect(cache.pages[0].data.map((c) => c._id)).toEqual(['c0', 'c2']);
    });
  });
});

describe('httpStatus', () => {
  it('reads the status wherever the SDK put it', () => {
    expect(httpStatus({ status: 409 })).toBe(409);
    expect(httpStatus({ response: { status: 409 } })).toBe(409);
    expect(httpStatus({ statusCode: 404 })).toBe(404);
    expect(httpStatus({ status: 0 })).toBeNull();
    expect(httpStatus(new Error('x'))).toBeNull();
    expect(httpStatus(null)).toBeNull();
  });
});
