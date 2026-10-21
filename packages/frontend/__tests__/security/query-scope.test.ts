import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  INBOX_ACCOUNT_QUERIES,
  INBOX_MUTATION_KEYS,
  queryClient,
} from '@/hooks/queries/queryClient';
import { aiKeys, emailKeys } from '@/hooks/queries/queryKeys';

/** Every root string a key factory entry can produce. */
function emailKeyRoots(): Set<string> {
  const roots = new Set<string>();
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      if (typeof value[0] === 'string') roots.add(value[0]);
    } else if (typeof value === 'function') {
      try {
        visit((value as (...args: unknown[]) => unknown)({}));
      } catch {
        // A builder that needs real arguments; its broad `root` sibling covers it.
      }
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(visit);
    }
  };
  visit(emailKeys);
  visit(aiKeys);
  roots.add('daily-brief'); // `useDailyBrief` builds its own key
  return roots;
}

describe('Inbox private-data isolation', () => {
  // The SDK isolates and persists per account exactly what it is told about.
  // A root left out would survive an account switch in memory.
  it('declares every private query root to the SDK', () => {
    const declared = new Set([
      ...INBOX_ACCOUNT_QUERIES.roots,
      ...(INBOX_ACCOUNT_QUERIES.memoryOnlyRoots ?? []),
    ]);
    for (const root of emailKeyRoots()) {
      expect(declared).toContain(root);
    }
  });

  it('never writes signed URLs, AI output or search results to disk', () => {
    for (const root of ['attachment-url', 'inbox-ai', 'search', 'smartReplies', 'threadSummary']) {
      expect(INBOX_ACCOUNT_QUERIES.roots).not.toContain(root);
    }
  });

  it('replays every queued message mutation for the same account only', () => {
    expect(INBOX_ACCOUNT_QUERIES.mutationKeys).toEqual(Object.values(INBOX_MUTATION_KEYS));
  });

  // Unkeyed, a mutation waiting offline was not the SDK's to drop on an account
  // switch: pin, labels, snooze and the bulk actions resumed under the new
  // account's credentials. Each key also needs its replay function.
  it('keys every mutation that can wait offline, with a function to replay it', () => {
    for (const key of [
      'togglePin',
      'updateLabels',
      'snooze',
      'unsnooze',
      'bulkFlags',
      'bulkMove',
    ]) {
      expect(INBOX_MUTATION_KEYS).toHaveProperty(key);
    }
    for (const key of Object.values(INBOX_MUTATION_KEYS)) {
      expect(queryClient.getMutationDefaults(key).mutationFn).toEqual(expect.any(Function));
    }
  });
});

describe('Inbox Service Worker privacy boundary', () => {
  it('never caches or replays private API responses with raw fetch', () => {
    const serviceWorker = readFileSync(resolve(__dirname, '../../public/sw.js'), 'utf8');

    expect(serviceWorker).toContain("return 'network-only';");
    expect(serviceWorker).not.toContain('API_CACHE');
    expect(serviceWorker).not.toContain('processOfflineQueue');
    expect(serviceWorker).not.toContain('fetch(mutation.url');
    expect(serviceWorker).toMatch(/const CACHE_NAME = 'inbox-v\d+';/);
    expect(serviceWorker).toContain("self.addEventListener('push'");
    expect(serviceWorker).toContain("self.addEventListener('notificationclick'");
    // biome-ignore lint/suspicious/noTemplateCurlyInString: matches the template literal in sw.js as source text.
    expect(serviceWorker).toContain('new URL(`/conversation/${encodeURIComponent(messageId)}`');
  });
});
