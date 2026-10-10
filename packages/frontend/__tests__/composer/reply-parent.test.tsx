/**
 * A reply must never leave without its threading headers. While the parent it
 * answers is loading, or after it failed to load, the composer's send path is
 * blocked and — on failure — the user is told why and can retry.
 */

const useMessage = jest.fn();
jest.mock('@/hooks/queries/useMessage', () => ({
  useMessage: (id: string | undefined) => useMessage(id),
}));
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@oxy.so/bloom/admonition', () => {
  const pass = ({ children }: { children?: unknown }) => children;
  return {
    AdmonitionRoot: ({ children, type }: { children?: unknown; type?: string }) =>
      require('react').createElement('div', { role: 'alert', 'data-type': type }, children),
    AdmonitionRow: pass,
    AdmonitionIcon: () => null,
    AdmonitionContent: pass,
    AdmonitionText: ({ children }: { children?: unknown }) =>
      require('react').createElement('p', null, children),
    AdmonitionButton: ({ children, onPress }: { children?: unknown; onPress?: () => void }) =>
      require('react').createElement('button', { onClick: onPress }, children),
  };
});

import React from 'react';
import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useReplyParent } from '@/hooks/useReplyParent';
import { ReplyParentNotice } from '@/components/ReplyParentNotice';

const parent = { messageId: '<case@amazon.com>', references: ['<root@amazon.com>'] };

function query(
  state: Partial<{ data: unknown; isError: boolean; isFetching: boolean; isFetched: boolean }>,
) {
  return {
    data: undefined,
    isError: false,
    isFetching: false,
    isFetched: false,
    refetch: jest.fn(),
    ...state,
  };
}

beforeEach(() => useMessage.mockReset());

describe('useReplyParent', () => {
  it('blocks sending while the parent is loading', () => {
    useMessage.mockReturnValue(query({ isFetching: true }));
    const { result } = renderHook(() => useReplyParent('row-1'));
    expect(result.current.status).toBe('loading');
    expect(result.current.blocksSend).toBe(true);
    expect(result.current.headers).toBeUndefined();
  });

  it('keeps sending blocked when the parent fails to load', () => {
    useMessage.mockReturnValue(query({ isError: true, isFetched: true }));
    const { result } = renderHook(() => useReplyParent('row-1'));
    expect(result.current.status).toBe('error');
    expect(result.current.blocksSend).toBe(true);
  });

  it('treats a parent that settled with no message as a failure, not as ready', () => {
    useMessage.mockReturnValue(query({ data: null, isFetched: true }));
    expect(renderHook(() => useReplyParent('row-1')).result.current.status).toBe('error');
  });

  it('unblocks with the RFC headers once the parent is known', () => {
    useMessage.mockReturnValue(query({ data: parent, isFetched: true }));
    const { result } = renderHook(() => useReplyParent('row-1'));
    expect(result.current.blocksSend).toBe(false);
    expect(result.current.headers).toEqual({
      inReplyTo: '<case@amazon.com>',
      references: ['<root@amazon.com>', '<case@amazon.com>'],
    });
  });

  it('never blocks a message that is not a reply', () => {
    useMessage.mockReturnValue(query({}));
    expect(renderHook(() => useReplyParent(undefined)).result.current).toMatchObject({
      status: 'none',
      blocksSend: false,
    });
  });
});

describe('ReplyParentNotice', () => {
  it('shows nothing while loading — the Send button carries that state', () => {
    const { container } = render(
      <ReplyParentNotice state={{ status: 'loading', retry: jest.fn() }} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows a visible error with a working retry when the parent failed to load', () => {
    const retry = jest.fn();
    render(<ReplyParentNotice state={{ status: 'error', retry }} />);
    expect(screen.getByRole('alert').getAttribute('data-type')).toBe('error');
    expect(screen.getByText('compose.replyParentError')).toBeTruthy();
    fireEvent.click(screen.getByText('common.retry'));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('retry refetches the parent', () => {
    const refetch = jest.fn().mockResolvedValue(undefined);
    useMessage.mockReturnValue({ ...query({ isError: true, isFetched: true }), refetch });
    renderHook(() => useReplyParent('row-1')).result.current.retry();
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
