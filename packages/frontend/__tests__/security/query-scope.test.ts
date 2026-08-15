import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { queryClient, hashInboxQueryKey } from '@/hooks/queries/queryClient';
import {
  emailKeys,
  getInboxQueryScope,
  PERSISTED_QUERY_ROOTS,
  setInboxQueryScope,
} from '@/hooks/queries/queryKeys';

describe('Inbox private-data isolation', () => {
  afterEach(() => {
    queryClient.clear();
    setInboxQueryScope(null);
  });

  it('hashes the same legacy key differently for different sessions', () => {
    setInboxQueryScope('session-a');
    const sessionAHash = hashInboxQueryKey(emailKeys.labels);

    setInboxQueryScope('session-b');
    const sessionBHash = hashInboxQueryKey(emailKeys.labels);

    expect(sessionAHash).not.toBe(sessionBHash);
    expect(getInboxQueryScope()).toBe('session-b');
  });

  it('does not expose one session cache data through another session key', () => {
    setInboxQueryScope('session-a');
    queryClient.setQueryData(emailKeys.labels, [{ _id: 'label-a' }]);

    setInboxQueryScope('session-b');
    expect(queryClient.getQueryData(emailKeys.labels)).toBeUndefined();

    setInboxQueryScope('session-a');
    expect(queryClient.getQueryData(emailKeys.labels)).toEqual([{ _id: 'label-a' }]);
  });

  it('keeps every persisted private-data root behind the scoped hash boundary', () => {
    setInboxQueryScope('session-a');
    const sessionAHashes = [...PERSISTED_QUERY_ROOTS].map((root) =>
      hashInboxQueryKey([root]),
    );

    setInboxQueryScope('session-b');
    const sessionBHashes = [...PERSISTED_QUERY_ROOTS].map((root) =>
      hashInboxQueryKey([root]),
    );

    expect(sessionAHashes).not.toEqual(sessionBHashes);
  });
});

describe('Inbox Service Worker privacy boundary', () => {
  it('never caches or replays private API responses with raw fetch', () => {
    const serviceWorker = readFileSync(resolve(__dirname, '../../public/sw.js'), 'utf8');

    expect(serviceWorker).toContain("return 'network-only';");
    expect(serviceWorker).not.toContain('API_CACHE');
    expect(serviceWorker).not.toContain('processOfflineQueue');
    expect(serviceWorker).not.toContain("fetch(mutation.url");
    expect(serviceWorker).toContain("const CACHE_NAME = 'inbox-v1';");
  });
});
