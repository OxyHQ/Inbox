/**
 * Service Worker for Inbox by Oxy
 *
 * Caching strategies (chosen for an email client that has to feel instant
 * but also stay fresh):
 *
 * - App shell (HTML, navigation): network-first
 *   Always try the network so a deploy is visible on the next page load.
 *   Fall back to the cached `/index.html` shell when offline so the SPA
 *   can still mount and surface the offline state instead of a browser
 *   error page.
 *
 * - Static assets (.js, .css, fonts, images): stale-while-revalidate
 *   Serve from cache for instant paint, then update the cache in the
 *   background. Versioned filenames (hash-suffixed by Metro) make a
 *   change safe to pick up on the next reload without manual cache
 *   busting.
 *
 * - API calls (api.oxy.so, /api/*): network-only
 *   Private responses are never stored or served by this worker. TanStack
 *   Query owns the authenticated offline cache and the SDK owns auth on
 *   replay; this worker must not capture bearer or CSRF headers.
 *
 * Bumping `CACHE_NAME` invalidates old shell caches on the next `activate`
 * event; any legacy API cache is deleted there as well.
 */

const CACHE_NAME = 'inbox-v1';

// App shell files cached on install. Keep this list short — large entries
// here block the install step. Anything else gets cached on first fetch.
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
];

// ─── Install ────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).catch((err) => {
        // Non-fatal: shell will be cached on first fetch instead
        console.warn('[SW] Failed to pre-cache app shell:', err);
      });
    })
  );
  // Activate immediately without waiting for existing clients
  self.skipWaiting();
});

// ─── Activate ───────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  // Take control of all open clients immediately
  self.clients.claim();
});

// ─── Fetch Strategies ───────────────────────────────────────────────

/**
 * Determine the caching strategy for a request.
 *
 * Returns one of:
 *  - `'network-only'` — let the browser handle it (private API requests and
 *    mutations)
 *  - `'stale-while-revalidate'` — serve cache immediately, refresh in
 *    background. Best for versioned static assets.
 *  - `'network-first'` — try network, fall back to cache.
 */
function getStrategy(request) {
  const url = new URL(request.url);

  // Skip non-GET requests; authenticated mutations stay in the SDK/TanStack
  // flow and are never replayed by this worker.
  if (request.method !== 'GET') return 'network-only';

  // Private API requests are deliberately never cached. This includes both
  // same-origin `/api/*` routes and the authenticated Oxy API origin.
  if (url.pathname.startsWith('/api/') || url.hostname === 'api.oxy.so') {
    return 'network-only';
  }

  // Static assets: stale-while-revalidate. Metro hashes filenames so old
  // entries are safe to keep until a new fetch replaces them.
  if (
    url.pathname.match(/\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|gif|svg|ico|webp)$/) ||
    url.pathname.startsWith('/_expo/') ||
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/assets/')
  ) {
    return 'stale-while-revalidate';
  }

  // Navigation / HTML: network-first (app shell fallback)
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    return 'network-first';
  }

  // Default: network-first
  return 'network-first';
}

/**
 * Network-first: try network, fall back to cache.
 */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    // For navigation requests, return cached app shell
    if (request.mode === 'navigate') {
      const shell = await caches.match('/index.html');
      if (shell) return shell;
    }

    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

/**
 * Stale-while-revalidate: respond with the cached value immediately (if any)
 * while kicking off a background fetch that refreshes the cache for next time.
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) return cached;
  const fresh = await fetchPromise;
  if (fresh) return fresh;
  return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
}

self.addEventListener('fetch', (event) => {
  const strategy = getStrategy(event.request);

  if (strategy === 'network-only') return; // Let the browser handle it

  if (strategy === 'stale-while-revalidate') {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // network-first for the public app shell and non-API same-origin resources.
  event.respondWith(networkFirst(event.request, CACHE_NAME));
});

// ─── Messages from clients ──────────────────────────────────────────

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
