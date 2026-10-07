jest.mock('@/components/EmptyStateSticker', () => ({ EmptyStateSticker: () => null }));
/**
 * A message the client cannot read must never vanish from any view: the
 * conversation, search and bundled reads carry their unreadable rows, and the
 * UI renders them in place.
 */

jest.mock('react-native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  const el =
    (tag: string) =>
    ({
      children,
      onPress,
      accessibilityRole,
      accessibilityLabel,
    }: Record<string, unknown>) =>
      React.createElement(
        onPress ? 'button' : tag,
        {
          onClick: onPress,
          role: accessibilityRole,
          'aria-label': accessibilityLabel,
        },
        children,
      );
  return {
    Platform: { OS: 'web' },
    View: el('div'),
    Text: el('span'),
    Pressable: el('div'),
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  };
});
// This suite verifies Inbox data and recovery callbacks. Bloom owns rendering;
// its real components are exercised by the browser fixture.
jest.mock('@oxy.so/bloom/card', () => ({
  Card: ({
    children,
    onPress,
    accessibilityLabel,
  }: {
    children: React.ReactNode;
    onPress?: () => void;
    accessibilityLabel?: string;
  }) =>
    onPress ? (
      <button onClick={onPress} aria-label={accessibilityLabel}>
        {children}
      </button>
    ) : (
      <div>{children}</div>
    ),
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CardTitle: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
  CardDescription: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));
jest.mock('@oxy.so/bloom/icons', () => ({ RiErrorWarningLine: () => null }));
jest.mock('@oxy.so/bloom/empty-state', () => ({
  EmptyState: ({
    title,
    description,
    action,
    secondaryAction,
  }: {
    title: string;
    description?: string;
    action?: { label: string; onPress: () => void };
    secondaryAction?: { label: string; onPress: () => void };
  }) => (
    <div>
      <span>{title}</span>
      <span>{description}</span>
      {action && <button onClick={action.onPress}>{action.label}</button>}
      {secondaryAction && (
        <button onClick={secondaryAction.onPress}>
          {secondaryAction.label}
        </button>
      )}
    </div>
  ),
}));
jest.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/utils/inboxTelemetry', () => ({ recordInboxMetric: jest.fn() }));

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { createEmailApi } from '@/services/emailApi';
import type { Message, UnreadableMessage } from '@/services/emailApi';
import { UnreadableMessageRow } from '@/components/UnreadableMessageRow';
import { UnreadableThreadEntry } from '@/components/UnreadableThreadEntry';
import { buildThreadEntries } from '@/utils/threadEntries';
import { buildSearchItems, collectUnreadable } from '@/utils/searchItems';
import { updateThreadMessage } from '@/utils/messageCache';
import { wireMessage } from '../fixtures/wire';

const broken = (id: string, receivedAt: string) => ({
  ...wireMessage({
    _id: id,
    subject: `broken ${id}`,
    receivedAt,
    date: receivedAt,
  }),
  from: null,
});

function apiReturning(body: unknown) {
  return createEmailApi({ get: jest.fn().mockResolvedValue(body) } as never);
}

let consoleError: jest.SpyInstance;
beforeEach(() => {
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => consoleError.mockRestore());

describe('reads carry their unreadable rows', () => {
  it('a thread keeps the row it could not parse', async () => {
    const ok = wireMessage({ _id: 'ok-1' });
    const thread = await apiReturning([
      ok,
      broken('bad-1', '2026-09-27T05:00:00.000Z'),
    ]).getThread('ok-1');
    expect(thread.messages.map((m) => m._id)).toEqual(['ok-1']);
    expect(thread.unreadable).toEqual([
      expect.objectContaining({
        kind: 'unreadable',
        _id: 'bad-1',
        subject: 'broken bad-1',
      }),
    ]);
  });

  it('search results keep them', async () => {
    const page = await apiReturning({
      data: [
        wireMessage({ _id: 'ok-1' }),
        broken('bad-1', '2026-09-27T05:00:00.000Z'),
      ],
      pagination: { total: 2, limit: 50, offset: 0, hasMore: false },
    }).search({ q: 'ramp' });
    expect(page.data).toHaveLength(1);
    expect(page.unreadable.map((row) => row._id)).toEqual(['bad-1']);
  });

  it('bundled reads keep them in primary and in each bundle, with the server unread count', async () => {
    const bundled = await apiReturning({
      data: {
        primary: [broken('bad-p', '2026-09-27T05:00:00.000Z')],
        bundles: [
          {
            bundle: {
              _id: 'b1',
              id: 'b1',
              userId: 'user-1',
              name: 'Updates',
              icon: 'bell',
              color: '#000',
              matchLabels: [],
              enabled: true,
              collapsed: true,
              order: 0,
              createdAt: '2026-09-27T00:00:00.000Z',
              updatedAt: '2026-09-27T00:00:00.000Z',
            },
            messages: [
              wireMessage({ _id: 'ok-b' }),
              broken('bad-b', '2026-09-27T05:00:00.000Z'),
            ],
            unreadCount: 2,
          },
        ],
      },
      pagination: { total: 3, limit: 50, offset: 0, hasMore: false },
    }).listBundledMessages();
    expect(bundled.primaryUnreadable.map((row) => row._id)).toEqual(['bad-p']);
    expect(bundled.bundles[0].unreadable.map((row) => row._id)).toEqual([
      'bad-b',
    ]);
    expect(bundled.bundles[0].unreadCount).toBe(2);
  });
});

describe('thread entries', () => {
  const at = (id: string, date: string) =>
    wireMessage({ _id: id, date, receivedAt: date }) as unknown as Message;
  const row = (
    id: string | null,
    receivedAt: string | null,
  ): UnreadableMessage => ({
    kind: 'unreadable',
    _id: id,
    from: null,
    subject: null,
    receivedAt,
  });

  it('places an unreadable message in reading order, and one without a date last', () => {
    const entries = buildThreadEntries(
      [
        at('a', '2026-09-27T01:00:00.000Z'),
        at('c', '2026-09-27T03:00:00.000Z'),
      ],
      [row('b', '2026-09-27T02:00:00.000Z'), row(null, null)],
    );
    expect(
      entries.map((e) =>
        e.kind === 'message' ? e.message._id : `!${e.row._id}`,
      ),
    ).toEqual(['a', '!b', 'c', '!null']);
  });

  it('a flag patch on the thread cache leaves its unreadable rows alone', () => {
    const cached = {
      messages: [at('a', '2026-09-27T01:00:00.000Z')],
      unreadable: [row('b', null)],
    };
    const next = updateThreadMessage(cached, 'a', (m) => ({
      ...m,
      flags: { ...m.flags, seen: true },
    }));
    expect(next?.messages[0].flags.seen).toBe(true);
    expect(next?.unreadable).toBe(cached.unreadable);
  });
});

describe('search items', () => {
  it('lists unreadable results first, each once across pages', () => {
    const r = (id: string): UnreadableMessage => ({
      kind: 'unreadable',
      _id: id,
      from: null,
      subject: null,
      receivedAt: null,
    });
    const unreadable = collectUnreadable([
      { unreadable: [r('x')] },
      { unreadable: [r('x'), r('y')] },
      {},
    ]);
    const items = buildSearchItems(
      [wireMessage({ _id: 'ok' }) as unknown as Message],
      unreadable,
    );
    expect(items.map((i) => i.key)).toEqual([
      'unreadable-x',
      'unreadable-y',
      'ok',
    ]);
  });
});

describe('rendering', () => {
  const row: UnreadableMessage = {
    kind: 'unreadable',
    _id: 'bad-1',
    from: 'Ramp',
    subject: 'Your code',
    receivedAt: null,
  };

  it('the list row says the message is there and opens it', () => {
    const onOpen = jest.fn();
    render(<UnreadableMessageRow message={row} onOpen={onOpen} />);
    expect(screen.getByText('inbox.unreadable.title')).toBeTruthy();
    expect(screen.getByText('Ramp · Your code')).toBeTruthy();
    fireEvent.click(screen.getByRole('button'));
    expect(onOpen).toHaveBeenCalledWith('bad-1');
  });

  it('the thread entry offers retry and the original', () => {
    const onRetry = jest.fn();
    const onOpenRaw = jest.fn();
    render(
      <UnreadableThreadEntry
        row={row}
        onRetry={onRetry}
        onOpenRaw={onOpenRaw}
      />,
    );
    expect(screen.getByText('inbox.unreadable.title')).toBeTruthy();
    fireEvent.click(screen.getByText('inbox.unreadable.retry'));
    fireEvent.click(screen.getByText('inbox.unreadable.openRaw'));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onOpenRaw).toHaveBeenCalledWith('bad-1');
  });

  it('without an id there is nothing to open, but retry remains', () => {
    render(
      <UnreadableThreadEntry
        row={{ ...row, _id: null }}
        onRetry={jest.fn()}
        onOpenRaw={jest.fn()}
      />,
    );
    expect(screen.queryByText('inbox.unreadable.openRaw')).toBeNull();
    expect(screen.getByText('inbox.unreadable.retry')).toBeTruthy();
  });
});
