import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

function workerHarness(redirects = {}) {
  const origin = 'https://example.test';
  const entries = new Map();
  const listeners = new Map();
  const key = (value) => new URL(typeof value === 'string' ? value : value.url, origin).href;
  const cache = {
    put: async (request, response) => entries.set(key(request), response),
    match: async (request) => entries.get(key(request))?.clone(),
    keys: async () => [...entries.keys()].map((url) => new Request(url)),
    delete: async (request) => entries.delete(key(request)),
  };
  let online = true;
  const context = {
    URL,
    Response,
    Request,
    console,
    self: {
      location: { origin },
      addEventListener: (name, callback) => listeners.set(name, callback),
    },
    caches: { open: async () => cache, match: cache.match },
    fetch: async (request) => {
      if (!online) throw new Error('offline');
      const destination = redirects[new URL(request.url).pathname] ?? new URL(request.url).pathname;
      const response = new Response(destination, { headers: { 'content-type': 'text/html' } });
      Object.defineProperty(response, 'url', { value: new URL(destination, origin).href });
      return response;
    },
  };
  vm.runInNewContext(
    readFileSync(new URL('../packages/frontend/public/sw.js', import.meta.url), 'utf8'),
    context,
  );
  return {
    entries,
    offline: () => {
      online = false;
    },
    request: async (pathname, options = {}) => {
      let result;
      listeners.get('fetch')({
        request: {
          url: new URL(pathname, origin).href,
          method: 'GET',
          headers: new Headers(),
          mode: 'navigate',
          ...options,
        },
        respondWith: (promise) => {
          result = promise;
        },
      });
      return result;
    },
  };
}

test('generated classic worker caches bounded route families and restores only the matching document offline', async () => {
  const worker = workerHarness();
  for (const path of [
    '/',
    '/conversation/a',
    '/conversation/b',
    '/search',
    '/search/conversation/c',
    '/compose',
  ]) {
    assert.equal((await worker.request(path)).status, 200);
  }
  assert.equal(worker.entries.size, 5);
  worker.offline();
  for (const [path, expected] of [
    ['/', '/'],
    ['/conversation/new-id', '/conversation/b'],
    ['/search/', '/search'],
    ['/search/conversation/new-id', '/search/conversation/c'],
    ['/compose', '/compose'],
  ]) {
    const response = await worker.request(path);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), expected);
  }
});

test('offline navigation never substitutes an Inbox document for an unvisited conversation family', async () => {
  const worker = workerHarness();
  await worker.request('/');
  worker.offline();
  assert.equal((await worker.request('/conversation/not-cached')).status, 503);
  assert.equal((await worker.request('/search/conversation/not-cached')).status, 503);
});

test('private API responses, mutations and cross-origin requests bypass the generated worker', async () => {
  const worker = workerHarness();
  for (const [path, options] of [
    ['/api/messages', {}],
    ['https://api.oxy.so/messages', {}],
    ['/conversation/private', { headers: new Headers({ authorization: 'Bearer test-only' }) }],
    ['/compose', { method: 'POST' }],
  ])
    assert.equal(await worker.request(path, options), undefined);
  assert.equal(worker.entries.size, 0);
});

for (const [alias, destination] of [
  ['/compose.html', '/compose'],
  ['/search/index.html', '/search/'],
]) {
  test(`redirected ${alias} HTML cannot replace the cached Inbox document`, async () => {
    const worker = workerHarness({ [alias]: destination });
    await worker.request('/');
    await worker.request(alias);
    worker.offline();
    assert.equal(await (await worker.request('/')).text(), '/');
    assert.equal(await (await worker.request(destination)).text(), destination);
    assert.equal((await worker.request(alias)).status, 503);
  });
}

test('internal Expo group aliases never replace the public Inbox cache', async () => {
  const worker = workerHarness();
  await worker.request('/');
  for (const path of [
    '/(inbox)/compose',
    '/(drawer)/search/',
    '/%28drawer%29/search/',
    '/unexpected/nested/path',
  ]) {
    await worker.request(path);
  }
  assert.equal(worker.entries.size, 1);
  worker.offline();
  assert.equal(await (await worker.request('/')).text(), '/');
  assert.equal((await worker.request('/(inbox)/compose')).status, 503);
});
