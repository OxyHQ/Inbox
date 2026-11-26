import type { StorageInterface } from '@/hooks/queries/accountQueryPersistence';
import type { SubjectSource } from '@/hooks/queries/inboxAccountCache';

/** The email API surface the account-cache tests read through. */
export interface FakeApi {
  listLabels: jest.Mock;
  listMessages: jest.Mock;
}

/** A Map-backed `StorageInterface` whose contents a test can inspect. */
export function memoryStorage(
  initial: Record<string, string> = {},
): StorageInterface & { values: Map<string, string> } {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
    removeItem: async (key) => {
      values.delete(key);
    },
  };
}

/**
 * The session as Services' runtime publishes it: `become` commits the new
 * subject to the snapshot, then wakes every subscriber in one synchronous pass
 * (`createOxyRuntime`'s `transition` → `notify`).
 */
export function createRuntime(initial: string | null): SubjectSource & {
  become: (id: string | null) => void;
} {
  let account: { id: string } | null = initial ? { id: initial } : null;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => ({ account }),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    become: (id) => {
      account = id ? { id } : null;
      for (const listener of [...listeners]) listener();
    },
  };
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
