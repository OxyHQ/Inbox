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
