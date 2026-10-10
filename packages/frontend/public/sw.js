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
 * - Everything cross-origin, and any request carrying credentials: network-only
 *   Private responses are never stored or served by this worker. TanStack
 *   Query owns the authenticated offline cache and the SDK owns auth on
 *   replay; this worker must not capture bearer or CSRF headers. Excluding
 *   only api.oxy.so was not enough: the Alia catalogue (api.alia.onl, with a
 *   Bearer header) was cached and served by URL to whoever was signed in next.
 *
 * Bumping `CACHE_NAME` invalidates old caches on the next `activate` event.
 * The cache is also bounded (`MAX_ENTRIES`): hashed bundles from earlier
 * deploys are dropped oldest-first instead of accumulating forever.
 */

const CACHE_NAME = 'inbox-v3';
const SHELL_KEY = '/index.html';
const MAX_ENTRIES = 150;

// App shell files cached on install. Keep this list short — large entries
// here block the install step. Anything else gets cached on first fetch.
const APP_SHELL = ['/', '/index.html', '/manifest.json'];

// ─── Install ────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).catch((err) => {
        // Non-fatal: shell will be cached on first fetch instead
        console.warn('[SW] Failed to pre-cache app shell:', err);
      });
    }),
  );
  // Activate immediately without waiting for existing clients
  self.skipWaiting();
});

// ─── Activate ───────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    }),
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

  // Only this origin's public files are ever cached. Anything else — the Oxy
  // and Alia APIs, the image proxy, fonts — is left to the browser.
  if (url.origin !== self.location.origin) return 'network-only';
  if (request.headers.has('authorization')) return 'network-only';
  if (url.pathname.startsWith('/api/')) return 'network-only';

  // Static assets: stale-while-revalidate. Metro hashes filenames so old
  // entries are safe to keep until a new fetch replaces them.
  if (
    url.pathname.match(/\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|gif|svg|ico|webp)$/) ||
    url.pathname.startsWith('/_expo/') ||
    url.pathname.startsWith('/assets/')
  ) {
    return 'stale-while-revalidate';
  }

  // Navigation: network-first, falling back to the one cached shell.
  if (request.mode === 'navigate') return 'navigation';

  return 'network-first';
}

/** Drop the oldest entries beyond `MAX_ENTRIES` (keys are in insertion order). */
async function trimCache(cache) {
  const keys = await cache.keys();
  const excess = keys.length - MAX_ENTRIES;
  for (let i = 0; i < excess; i++) {
    if (new URL(keys[i].url).pathname !== SHELL_KEY) await cache.delete(keys[i]);
  }
}

/**
 * Navigation: the network, else the cached shell. Every route is the same SPA
 * shell, so it is stored ONCE under `/index.html` — storing each
 * `/conversation/<id>` visited kept a copy of the shell per message opened.
 */
async function navigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(SHELL_KEY, response.clone());
    }
    return response;
  } catch {
    const shell = await caches.match(SHELL_KEY);
    if (shell) return shell;
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

/**
 * Network-first: try network, fall back to cache.
 */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
      void trimCache(cache);
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
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
        void cache.put(request, response.clone()).then(() => trimCache(cache));
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

  if (strategy === 'navigation') {
    event.respondWith(navigation(event.request));
    return;
  }

  // network-first for the public app shell and non-API same-origin resources.
  event.respondWith(networkFirst(event.request, CACHE_NAME));
});

// ─── Web push ──────────────────────────────────────────────────────

// The fallback words of a push that carries no sender or body, in the
// browser's language: a service worker has no access to the app's i18n, and
// they were English for everyone.
const FALLBACK_STRINGS = {
  en: { title: 'New email', body: 'You have a new message.' },
  es: { title: 'Correo nuevo', body: 'Tienes un mensaje nuevo.' },
  ca: { title: 'Correu nou', body: 'Tens un missatge nou.' },
  de: { title: 'Neue E-Mail', body: 'Du hast eine neue Nachricht.' },
  fr: { title: 'Nouveau courriel', body: 'Tu as un nouveau message.' },
  it: { title: 'Nuova email', body: 'Hai un nuovo messaggio.' },
  pt: { title: 'Novo email', body: 'Tens uma nova mensagem.' },
  ja: { title: '新着メール', body: '新しいメッセージがあります。' },
  ko: { title: '새 메일', body: '새 메시지가 있어요.' },
  zh: { title: '新邮件', body: '你有一封新邮件。' },
  ar: { title: 'رسالة جديدة', body: 'لديك رسالة جديدة.' },
};

function fallbackStrings() {
  const language = (self.navigator && self.navigator.language ? self.navigator.language : 'en')
    .slice(0, 2)
    .toLowerCase();
  return FALLBACK_STRINGS[language] || FALLBACK_STRINGS.en;
}

function notificationPayload(data) {
  const fallback = fallbackStrings();
  const payload = data && typeof data === 'object' ? data : {};
  const messageId = typeof payload.messageId === 'string' ? payload.messageId : null;
  const sender = typeof payload.sender === 'string' ? payload.sender : fallback.title;
  const subject = typeof payload.subject === 'string' ? payload.subject : '';
  const body = typeof payload.body === 'string' ? payload.body : subject;

  return {
    title: sender,
    options: {
      body: body || fallback.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: messageId ? `inbox-message-${messageId}` : 'inbox-message',
      renotify: Boolean(messageId),
      data: { messageId },
    },
  };
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = { body: event.data ? event.data.text() : '' };
  }

  const notification = notificationPayload(data);
  event.waitUntil(self.registration.showNotification(notification.title, notification.options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const messageId = event.notification.data?.messageId;
  const target = messageId
    ? new URL(`/conversation/${encodeURIComponent(messageId)}`, self.location.origin).href
    : new URL('/', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // `navigate()` rejects for a window this worker does not control, which
      // `includeUncontrolled` can return; the click then did nothing at all.
      const existing = clients.find((client) => client.url.startsWith(self.location.origin));
      if (existing && 'navigate' in existing) {
        return existing
          .navigate(target)
          .then((client) => (client ?? existing).focus())
          .catch(() => self.clients.openWindow(target));
      }
      return self.clients.openWindow(target);
    }),
  );
});

// ─── Messages from clients ──────────────────────────────────────────

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
