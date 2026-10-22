import { renderHook, render, act } from '@testing-library/react';
import {
  DEFAULT_INBOX_PREFS,
  InboxPrefsProvider,
  getInboxPrefsStorageKey,
  getV2InboxPrefsStorageKey,
  mergeInboxPrefs,
  useInboxPrefs,
} from '@/contexts/inbox-prefs-context';

import { defined } from '../fixtures/defined';
import { useEffect } from 'react';

let mockPlatform = 'web';
const mockNativeGet = jest.fn();
const mockNativeSet = jest.fn();
jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatform;
    },
  },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (...args: unknown[]) => mockNativeGet(...args),
    setItem: (...args: unknown[]) => mockNativeSet(...args),
    removeItem: jest.fn(),
  },
}));

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

it('loads each account before rendering its children without remounting them, and rejects old setters', () => {
  localStorage.setItem(getInboxPrefsStorageKey('a'), JSON.stringify({ density: 'compact' }));
  localStorage.setItem(getInboxPrefsStorageKey('b'), JSON.stringify({ showPreviews: false }));
  const mounts = jest.fn();
  let prefs: ReturnType<typeof useInboxPrefs>;
  function Workspace() {
    const current = useInboxPrefs();
    useEffect(() => {
      prefs = current;
    }, [current]);
    useEffect(mounts, []);
    return (
      <main>
        {current.prefs.density}:{String(current.prefs.showPreviews)}
      </main>
    );
  }
  const view = render(
    <InboxPrefsProvider scope={null}>
      <Workspace />
    </InboxPrefsProvider>,
  );
  const workspace = view.getByRole('main');
  view.rerender(
    <InboxPrefsProvider scope="a">
      <Workspace />
    </InboxPrefsProvider>,
  );
  expect(workspace.textContent).toBe('compact:true');
  const oldSetter = defined(prefs).setPref;
  view.rerender(
    <InboxPrefsProvider scope="b">
      <Workspace />
    </InboxPrefsProvider>,
  );
  expect(workspace.textContent).toBe('comfortable:false');
  act(() => oldSetter('aiBrief', false));
  expect(defined(prefs).prefs.aiBrief).toBe(true);
  view.rerender(
    <InboxPrefsProvider scope="a">
      <Workspace />
    </InboxPrefsProvider>,
  );
  act(() => oldSetter('aiBrief', false));
  expect(defined(prefs).prefs.aiBrief).toBe(true);
  expect(view.getByRole('main')).toBe(workspace);
  expect(mounts).toHaveBeenCalledTimes(1);
  expect(JSON.parse(defined(localStorage.getItem(getInboxPrefsStorageKey('b'))))).toEqual({
    showPreviews: false,
  });
});

it('drops a native hydration completed after switching accounts and waits before persisting', async () => {
  mockPlatform = 'android';
  const pending = new Map<string, (value: string | null) => void>();
  mockNativeGet.mockImplementation(
    (key: string) => new Promise((resolve) => pending.set(key, resolve)),
  );
  mockNativeSet.mockResolvedValue(undefined);
  let prefs: ReturnType<typeof useInboxPrefs>;
  function Workspace() {
    const current = useInboxPrefs();
    useEffect(() => {
      prefs = current;
    }, [current]);
    return <main>{current.prefs.density}</main>;
  }
  try {
    const view = render(
      <InboxPrefsProvider scope="a">
        <Workspace />
      </InboxPrefsProvider>,
    );
    await act(async () => {});
    view.rerender(
      <InboxPrefsProvider scope="b">
        <Workspace />
      </InboxPrefsProvider>,
    );
    await act(async () => {});
    expect(mockNativeSet).not.toHaveBeenCalled();
    await act(async () => {
      defined(pending.get(getInboxPrefsStorageKey('a')))(JSON.stringify({ density: 'compact' }));
      defined(pending.get(getV2InboxPrefsStorageKey('a')))(null);
    });
    expect(defined(prefs).loaded).toBe(false);
    expect(defined(prefs).prefs.density).toBe('comfortable');
    expect(mockNativeSet).not.toHaveBeenCalled();
    await act(async () => {
      defined(pending.get(getInboxPrefsStorageKey('b')))(JSON.stringify({ showPreviews: false }));
      defined(pending.get(getV2InboxPrefsStorageKey('b')))(null);
    });
    expect(defined(prefs).loaded).toBe(true);
    expect(defined(prefs).prefs.showPreviews).toBe(false);
    expect(mockNativeSet).toHaveBeenCalledTimes(1);
    expect(mockNativeSet).toHaveBeenCalledWith(
      getInboxPrefsStorageKey('b'),
      JSON.stringify({ showPreviews: false }),
    );
  } finally {
    mockPlatform = 'web';
  }
});
