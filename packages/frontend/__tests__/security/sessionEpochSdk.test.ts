import { OxyServices } from '@oxy.so/core';

function token(userId: string, sessionId: string): string {
  const payload = Buffer.from(JSON.stringify({ userId, sessionId, exp: 2000000000 })).toString(
    'base64url',
  );
  return `e30.${payload}.fixture`;
}

function response(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 401 ? 'Unauthorized' : 'OK',
    headers: {
      get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
    clone() {
      return this;
    },
  };
}

it('rejects an old A response after 401 clears A and B signs in', async () => {
  const previousFetch = globalThis.fetch;
  let release!: (value: ReturnType<typeof response>) => void;
  let started!: () => void;
  const inFlight = new Promise<ReturnType<typeof response>>((resolve) => {
    release = resolve;
  });
  const firstStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  globalThis.fetch = jest.fn(async (input: string | URL | Request) => {
    if (String(input).endsWith('/old-labels')) {
      started();
      return inFlight;
    }
    return response(401, { error: 'expired' });
  }) as never;
  const oxy = new OxyServices({
    baseURL: 'https://api.test',
    enableRetry: false,
    enableCache: false,
  });
  try {
    oxy.session.setAccessToken(token('account-a', 'session-a'));
    const initialEpoch = oxy.http.getSessionEpoch();
    const oldRequest = oxy.http.get('/old-labels', { retry: false, deduplicate: false });
    const oldResult = oldRequest.catch((error) => error);
    await firstStarted;
    await expect(
      oxy.http.get('/expired', { retry: false, deduplicate: false }),
    ).rejects.toMatchObject({ status: 401 });
    expect(oxy.http.getAccessToken()).toBeNull();
    expect(oxy.http.getSessionEpoch()).toBeGreaterThan(initialEpoch);
    oxy.session.setAccessToken(token('account-b', 'session-b'));
    release(response(200, { data: [{ name: 'A private label' }] }));
    await expect(oldResult).resolves.toMatchObject({ code: 'AUTH_SESSION_CHANGED' });
    expect(oxy.http.getAccessToken()).toBe(token('account-b', 'session-b'));
  } finally {
    oxy.dispose();
    globalThis.fetch = previousFetch;
  }
});
