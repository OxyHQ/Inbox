import React from 'react';
import { renderHook, act } from '@testing-library/react';
import {
  DEFAULT_INBOX_PREFS,
  InboxPrefsProvider,
  getInboxPrefsStorageKey,
  getV2InboxPrefsStorageKey,
  mergeInboxPrefs,
  useInboxPrefs,
} from '@/contexts/inbox-prefs-context';

jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));

describe('Inbox preferences', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('offers the daily brief by default and rejects malformed persisted values', () => {
    expect(DEFAULT_INBOX_PREFS.aiBrief).toBe(true);

    expect(
      mergeInboxPrefs({ aiBrief: false, density: 'invalid', leftSwipeAction: 'invalid' }),
    ).toEqual({
      ...DEFAULT_INBOX_PREFS,
      aiBrief: false,
    });
  });

  it('stores only what the user chose', () => {
    const { result } = renderHook(() => useInboxPrefs(), {
      wrapper: ({ children }) => <InboxPrefsProvider>{children}</InboxPrefsProvider>,
    });

    expect(window.localStorage.getItem(getInboxPrefsStorageKey(null))).toBe('{}');
    act(() => {
      result.current.setPref('density', 'compact');
    });
    expect(JSON.parse(window.localStorage.getItem(getInboxPrefsStorageKey(null)) ?? '')).toEqual({
      density: 'compact',
    });
  });

  it('moves a v2 blob to v3, turning on the brief its old default turned off', () => {
    window.localStorage.setItem(
      getV2InboxPrefsStorageKey('user-a'),
      JSON.stringify({ ...DEFAULT_INBOX_PREFS, aiBrief: false, density: 'compact' }),
    );

    const { result } = renderHook(() => useInboxPrefs(), {
      wrapper: ({ children }) => <InboxPrefsProvider scope="user-a">{children}</InboxPrefsProvider>,
    });

    expect(result.current.prefs).toEqual({ ...DEFAULT_INBOX_PREFS, density: 'compact' });
    expect(
      JSON.parse(window.localStorage.getItem(getInboxPrefsStorageKey('user-a')) ?? ''),
    ).toEqual({
      density: 'compact',
    });
    expect(window.localStorage.getItem(getV2InboxPrefsStorageKey('user-a'))).toBeNull();
  });

  it('keeps a brief turned off after the move to v3', () => {
    window.localStorage.setItem(
      getInboxPrefsStorageKey('user-a'),
      JSON.stringify({ aiBrief: false }),
    );
    window.localStorage.setItem(
      getV2InboxPrefsStorageKey('user-a'),
      JSON.stringify({ aiBrief: true, density: 'compact' }),
    );

    const { result } = renderHook(() => useInboxPrefs(), {
      wrapper: ({ children }) => <InboxPrefsProvider scope="user-a">{children}</InboxPrefsProvider>,
    });

    expect(result.current.prefs.aiBrief).toBe(false);
    expect(result.current.prefs.density).toBe(DEFAULT_INBOX_PREFS.density);
  });

  it('updates a preference without dropping the other preferences', () => {
    const { result } = renderHook(() => useInboxPrefs(), {
      wrapper: ({ children }) => <InboxPrefsProvider>{children}</InboxPrefsProvider>,
    });

    act(() => {
      result.current.setPref('aiBrief', false);
    });

    expect(result.current.prefs.aiBrief).toBe(false);
    expect(result.current.prefs.density).toBe(DEFAULT_INBOX_PREFS.density);
    expect(window.localStorage.getItem(getInboxPrefsStorageKey(null))).toContain('"aiBrief":false');
  });

  it('keeps preferences isolated between user scopes', () => {
    const first = renderHook(() => useInboxPrefs(), {
      wrapper: ({ children }) => <InboxPrefsProvider scope="user-a">{children}</InboxPrefsProvider>,
    });

    act(() => {
      first.result.current.setPref('aiBrief', false);
    });
    first.unmount();

    const second = renderHook(() => useInboxPrefs(), {
      wrapper: ({ children }) => <InboxPrefsProvider scope="user-b">{children}</InboxPrefsProvider>,
    });

    expect(second.result.current.prefs.aiBrief).toBe(DEFAULT_INBOX_PREFS.aiBrief);
    expect(window.localStorage.getItem(getInboxPrefsStorageKey('user-a'))).toContain(
      '"aiBrief":false',
    );
    expect(window.localStorage.getItem(getInboxPrefsStorageKey('user-b'))).toBe('{}');
  });
});
