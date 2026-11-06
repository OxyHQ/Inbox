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

for (const [pathname, asset] of [
  ['/conversation/message-a?tracking=ignored', '/conversation/%5Bid%5D'],
  ['/search/conversation/message-b', '/search/conversation/%5Bid%5D'],
]) {
  test(`serves the public template for ${pathname} without redirecting the browser`, async () => {
    const request = new Request(`https://example.test${pathname}`);
    const response = new Response('public route template', {
      headers: { 'content-type': 'text/html' },
    });
    let assetRequest;
    const result = await worker0.fetch(request, {
      ASSETS: {
        fetch: async (value) => {
          assetRequest = value;
          return response;
        },
      },
    });
    assert.equal(result, response);
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('location'), null);
    assert.equal(new URL(assetRequest.url).pathname, asset);
    assert.equal(new URL(assetRequest.url).search, '');
    assert.equal(request.url, `https://example.test${pathname}`);
  });
}

for (const pathname of ['/label/receipts', '/sent', '/settings/account', '/api/messages']) {
  test(`preserves existing asset behavior for ${pathname}`, async () => {
    const request = new Request(`https://example.test${pathname}`);
    const response = new Response('unchanged');
    await worker0.fetch(request, {
      ASSETS: {
        fetch: async (value) => {
          assert.equal(value, request);
          return response;
        },
      },
    });
  });
}
