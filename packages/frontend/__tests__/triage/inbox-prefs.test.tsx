import React from 'react';
import { renderHook, act } from '@testing-library/react';
import {
  DEFAULT_INBOX_PREFS,
  InboxPrefsProvider,
  getInboxPrefsStorageKey,
  mergeInboxPrefs,
  useInboxPrefs,
} from '@/contexts/inbox-prefs-context';

jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));

describe('Inbox preferences', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('keeps the daily brief opt-in by default and rejects malformed persisted values', () => {
    expect(DEFAULT_INBOX_PREFS.aiBrief).toBe(false);

    expect(
      mergeInboxPrefs({ aiBrief: true, density: 'invalid', leftSwipeAction: 'invalid' }),
    ).toEqual({
      ...DEFAULT_INBOX_PREFS,
      aiBrief: true,
    });
  });

  it('updates a preference without dropping the other preferences', () => {
    const { result } = renderHook(() => useInboxPrefs(), {
      wrapper: ({ children }) => <InboxPrefsProvider>{children}</InboxPrefsProvider>,
    });

    act(() => {
      result.current.setPref('aiBrief', true);
    });

    expect(result.current.prefs.aiBrief).toBe(true);
    expect(result.current.prefs.density).toBe(DEFAULT_INBOX_PREFS.density);
    expect(window.localStorage.getItem(getInboxPrefsStorageKey(null))).toContain('"aiBrief":true');
  });

  it('keeps preferences isolated between user scopes', () => {
    const first = renderHook(() => useInboxPrefs(), {
      wrapper: ({ children }) => <InboxPrefsProvider scope="user-a">{children}</InboxPrefsProvider>,
    });

    act(() => {
      first.result.current.setPref('aiBrief', true);
    });
    first.unmount();

    const second = renderHook(() => useInboxPrefs(), {
      wrapper: ({ children }) => <InboxPrefsProvider scope="user-b">{children}</InboxPrefsProvider>,
    });

    expect(second.result.current.prefs.aiBrief).toBe(DEFAULT_INBOX_PREFS.aiBrief);
    expect(window.localStorage.getItem(getInboxPrefsStorageKey('user-a'))).toContain('"aiBrief":true');
    expect(window.localStorage.getItem(getInboxPrefsStorageKey('user-b'))).toContain('"aiBrief":false');
  });
});
