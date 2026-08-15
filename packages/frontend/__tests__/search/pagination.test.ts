import { getNextSearchPageParam, useSearchMessages } from '@/hooks/queries/useSearchMessages';
import { getNextMessagesPageParam } from '@/hooks/queries/useMessages';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useOxy } from '@oxyhq/services';
import { useEmailStore } from '@/hooks/useEmail';

jest.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: jest.fn(),
}));
jest.mock('@oxyhq/services', () => ({
  useOxy: jest.fn(),
}));
jest.mock('@/hooks/useEmail', () => ({
  useEmailStore: jest.fn(),
}));

describe('search pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('advances by the server offset and limit while more results exist', () => {
    expect(
      getNextSearchPageParam({
        data: [],
        pagination: { total: 125, limit: 50, offset: 0, hasMore: true },
      }),
    ).toBe(50);
  });

  it('stops at the end and rejects a zero-size looping page', () => {
    expect(
      getNextSearchPageParam({
        data: [],
        pagination: { total: 50, limit: 50, offset: 0, hasMore: false },
      }),
    ).toBeUndefined();
    expect(
      getNextSearchPageParam({
        data: [],
        pagination: { total: 100, limit: 0, offset: 50, hasMore: true },
      }),
    ).toBeUndefined();
  });

  it('prefers a server cursor for message and search pages', () => {
    const page = {
      data: [],
      pagination: {
        total: 200,
        limit: 50,
        offset: 0,
        hasMore: true,
        nextCursor: 'opaque-next-page',
      },
    };
    expect(getNextSearchPageParam(page)).toBe('opaque-next-page');
    expect(getNextMessagesPageParam(page)).toBe('opaque-next-page');
  });

  it('uses the server page parameter and keeps an explicit read filter in the client contract', async () => {
    const search = jest.fn().mockResolvedValue({
      data: [],
      pagination: { total: 100, limit: 50, offset: 50, hasMore: false },
    });
    (useOxy as jest.Mock).mockReturnValue({ user: { id: 'user-1' } });
    (useEmailStore as jest.Mock).mockImplementation((selector: (state: unknown) => unknown) =>
      selector({ _api: { search } }),
    );
    (useInfiniteQuery as jest.Mock).mockReturnValue({});

    useSearchMessages({ q: 'budget', unread: false });

    const config = (useInfiniteQuery as jest.Mock).mock.calls[0]?.[0] as {
      queryFn: (context: { pageParam: number }) => Promise<unknown>;
    };
    await config.queryFn({ pageParam: 50 });

    expect(search).toHaveBeenCalledWith({
      q: 'budget',
      unread: false,
      limit: 50,
      offset: 50,
    });
  });

  it('forwards an opaque cursor without converting it into an offset', async () => {
    const search = jest.fn().mockResolvedValue({
      data: [],
      pagination: { total: 100, limit: 50, offset: 0, hasMore: false },
    });
    (useOxy as jest.Mock).mockReturnValue({ user: { id: 'user-1' } });
    (useEmailStore as jest.Mock).mockImplementation((selector: (state: unknown) => unknown) =>
      selector({ _api: { search } }),
    );
    (useInfiniteQuery as jest.Mock).mockReturnValue({});

    useSearchMessages({ q: 'budget' });
    const config = (useInfiniteQuery as jest.Mock).mock.calls[0]?.[0] as {
      queryFn: (context: { pageParam: string }) => Promise<unknown>;
    };
    await config.queryFn({ pageParam: 'opaque-next-page' });

    expect(search).toHaveBeenCalledWith({
      q: 'budget',
      limit: 50,
      cursor: 'opaque-next-page',
    });
  });
});
