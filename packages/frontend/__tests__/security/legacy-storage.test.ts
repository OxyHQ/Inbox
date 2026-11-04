jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('@react-native-async-storage/async-storage', () => ({}));

import { removeLegacyStorage } from '@/utils/removeLegacyStorage';

describe('legacy Inbox storage', () => {
  const deleteDatabase = jest.fn();

  beforeEach(() => {
    deleteDatabase.mockClear();
    Object.defineProperty(window, 'indexedDB', { configurable: true, value: { deleteDatabase } });
  });

  it('deletes every blob Inbox persisted itself, and nothing else', async () => {
    window.localStorage.setItem('inbox_query_cache_v1', 'mail');
    window.localStorage.setItem('inbox_query_cache_v2:session-a', 'mail');
    window.localStorage.setItem(
      'inbox_offline_queue',
      '[{"headers":{"Authorization":"Bearer t"}}]',
    );
    window.localStorage.setItem('oxy_account_queries:alice', 'kept');

    await removeLegacyStorage();

    expect(window.localStorage.getItem('inbox_query_cache_v1')).toBeNull();
    expect(window.localStorage.getItem('inbox_query_cache_v2:session-a')).toBeNull();
    expect(window.localStorage.getItem('inbox_offline_queue')).toBeNull();
    expect(window.localStorage.getItem('oxy_account_queries:alice')).toBe('kept');
  });

  it('drops the legacy raw-fetch offline queue database', async () => {
    await removeLegacyStorage();

    expect(deleteDatabase).toHaveBeenCalledWith('inbox-offline');
  });
});
