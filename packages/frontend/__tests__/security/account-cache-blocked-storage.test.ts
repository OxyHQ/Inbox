/** A browser that blocks site storage keeps the account cache in memory instead of failing the app. */
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('@react-native-async-storage/async-storage', () => ({}));

import { createPlatformStorage } from '@/hooks/queries/inboxAccountCache';

describe('createPlatformStorage on the web', () => {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
  afterEach(() => {
    if (descriptor) Object.defineProperty(window, 'localStorage', descriptor);
  });

  it('falls back to memory when reading localStorage throws', async () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
    const storage = createPlatformStorage();
    await storage.setItem('k', 'v');
    expect(await storage.getItem('k')).toBe('v');
  });

  it('uses localStorage when the browser allows it', async () => {
    const storage = createPlatformStorage();
    await storage.setItem('inbox-test', '1');
    expect(window.localStorage.getItem('inbox-test')).toBe('1');
    await storage.removeItem('inbox-test');
  });
});
