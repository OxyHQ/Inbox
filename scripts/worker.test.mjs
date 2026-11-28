import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker0 from '../packages/frontend/worker/index.js';

test('frontend Worker returns the asset response, stream and headers untouched', async () => {
  const response = new Response('asset bytes', {
    headers: { 'content-type': 'application/javascript', 'cache-control': 'public, max-age=3600' },
  });
  const request = new Request('https://example.test/assets/app.js');
  const env = { ASSETS: { fetch: async () => response } };
  const ctx = {
    waitUntil() {
      throw new Error('the Worker schedules no background work');
    },
  };
  assert.equal(await worker0.fetch(request, env, ctx), response);
  assert.equal(await response.text(), 'asset bytes');
});

test('frontend Worker propagates an asset binding failure', async () => {
  const request = new Request('https://example.test/assets/app.js');
  const failure = new Error('asset binding failure');
  const env = {
    ASSETS: {
      fetch: async () => {
        throw failure;
      },
    },
  };
  await assert.rejects(
    async () => worker0.fetch(request, env, {}),
    (error) => error === failure,
  );
});

test('frontend Worker sends the old host to inbo.sh with the path and query, and serves inbo.sh itself', async () => {
  let served = 0;
  const env = {
    ASSETS: {
      fetch: async () => {
        served++;
        return new Response('asset');
      },
    },
  };
  const moved = await worker0.fetch(
    new Request('https://inbox.oxy.so/conversation/abc?x=1#frag'),
    env,
    {},
  );
  assert.equal(moved.status, 308);
  assert.equal(moved.headers.get('location'), 'https://inbo.sh/conversation/abc?x=1');
  assert.equal(served, 0);
  const home = await worker0.fetch(new Request('https://inbo.sh/'), env, {});
  assert.equal(await home.text(), 'asset');
  assert.equal(served, 1);
});

const HASHED = 'https://inbo.sh/_expo/static/js/web/entry-0123456789abcdef0123456789abcdef.js';
const shell = () =>
  new Response('<!doctype html>', { headers: { 'content-type': 'text/html; charset=utf-8' } });

test('frontend Worker answers a hashed-asset miss with an uncached 404, never the SPA shell', async () => {
  const result = await worker0.fetch(
    new Request(HASHED),
    { ASSETS: { fetch: async () => shell() } },
    {},
  );
  assert.equal(result.status, 404);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.equal(result.headers.get('content-type'), 'text/plain');
});

test('frontend Worker returns a hashed asset that exists untouched, and the shell on an app route', async () => {
  const asset = new Response('js', { headers: { 'content-type': 'application/javascript' } });
  assert.equal(
    await worker0.fetch(new Request(HASHED), { ASSETS: { fetch: async () => asset } }, {}),
    asset,
  );
  const page = shell();
  assert.equal(
    await worker0.fetch(
      new Request('https://inbo.sh/conversation/abc'),
      { ASSETS: { fetch: async () => page } },
      {},
    ),
    page,
  );
});
