import {
  clearComposeRecovery,
  composeRecoveryStorageKey,
  loadComposeRecovery,
  saveComposeRecovery,
} from '@/utils/composeRecovery';

describe('compose recovery', () => {
  const key = composeRecoveryStorageKey('user-a', 'new');

  beforeEach(() => {
    window.localStorage.clear();
  });

  it('scopes recovery records by account and compose identity', () => {
    expect(key).not.toBe(composeRecoveryStorageKey('user-b', 'new'));
    expect(key).not.toBe(composeRecoveryStorageKey('user-a', 'reply-1'));
  });

  it('round-trips a recovery snapshot without storing auth material', async () => {
    await saveComposeRecovery(key, {
      to: 'alice@example.com',
      cc: '',
      bcc: '',
      subject: 'Offline draft',
      body: '<p>Keep this locally.</p>',
      attachments: [{ fileId: 'file-1' }],
    });

    const stored = await loadComposeRecovery(key);
    expect(stored?.snapshot).toEqual({
      to: 'alice@example.com',
      cc: '',
      bcc: '',
      subject: 'Offline draft',
      body: '<p>Keep this locally.</p>',
      attachments: [{ fileId: 'file-1' }],
    });
    expect(window.localStorage.getItem(key)).not.toContain('Authorization');
    expect(window.localStorage.getItem(key)).not.toContain('Cookie');
  });

  it('rejects malformed records and clears valid records', async () => {
    window.localStorage.setItem(key, JSON.stringify({ snapshot: { body: 42 }, savedAt: Date.now() }));
    await expect(loadComposeRecovery(key)).resolves.toBeNull();

    await saveComposeRecovery(key, {
      to: '',
      cc: '',
      bcc: '',
      subject: 'Draft',
      body: 'body',
      attachments: [],
    });
    await clearComposeRecovery(key);
    await expect(loadComposeRecovery(key)).resolves.toBeNull();
  });
});
