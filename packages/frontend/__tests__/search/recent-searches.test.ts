import { addRecentSearch, mergeRecentSearches, recentSearchesStorageKey } from '@/hooks/useRecentSearches';

describe('recent searches', () => {
  it('deduplicates, trims, and caps private search history', () => {
    expect(mergeRecentSearches(['  budget ', 'budget', '', 42, 'one', 'two', 'three', 'four', 'five', 'six', 'seven'])).toEqual([
      'budget',
      'one',
      'two',
      'three',
      'four',
      'five',
    ]);
  });

  it('puts a newly submitted query first', () => {
    expect(addRecentSearch(['older', 'oldest'], 'new')).toEqual(['new', 'older', 'oldest']);
    expect(addRecentSearch(['older'], ' older ')).toEqual(['older']);
  });

  it('scopes storage keys to the active account', () => {
    expect(recentSearchesStorageKey('user-a')).not.toBe(recentSearchesStorageKey('user-b'));
  });
});
