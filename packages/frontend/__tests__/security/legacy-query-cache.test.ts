jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('@react-native-async-storage/async-storage', () => ({}));

import { removeLegacyQueryCache } from '@/utils/removeLegacyQueryCache';

describe('legacy Inbox query caches', () => {
  it('deletes every blob Inbox persisted itself, and nothing else', async () => {
    window.localStorage.setItem('inbox_query_cache_v1', 'mail');
    window.localStorage.setItem('inbox_query_cache_v2:session-a', 'mail');
    window.localStorage.setItem('oxy_account_queries:alice', 'kept');

    await removeLegacyQueryCache();

    expect(window.localStorage.getItem('inbox_query_cache_v1')).toBeNull();
    expect(window.localStorage.getItem('inbox_query_cache_v2:session-a')).toBeNull();
    expect(window.localStorage.getItem('oxy_account_queries:alice')).toBe('kept');
  });
});
