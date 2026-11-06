(() => {
  // constants/shell-routes.js
  var INBOX = { pathname: "/", asset: "/index.html", renderRoute: false, emptyDetail: true };
  var COMPOSE = { pathname: "/compose", asset: "/compose", renderRoute: true, emptyDetail: false };
  var SEARCH = { pathname: "/search", asset: "/search/", renderRoute: true, emptyDetail: true };
  var CONVERSATION = {
    pathname: "/conversation/[id]",
    asset: "/conversation/[id]",
    renderRoute: true,
    emptyDetail: false
  };
  var SEARCH_CONVERSATION = {
    pathname: "/search/conversation/[id]",
    asset: "/search/conversation/[id]",
    renderRoute: true,
    emptyDetail: false
  };
  var SUBSCRIPTIONS = {
    pathname: "/",
    asset: "/subscriptions",
    renderRoute: false,
    emptyDetail: false
  };
  var SHELL_DOCUMENT_ASSETS = [
    INBOX,
    COMPOSE,
    SEARCH,
    CONVERSATION,
    SEARCH_CONVERSATION,
    SUBSCRIPTIONS
  ].map((route) => route.asset);
  function getShellRoute(pathname) {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length === 1 && parts[0] === "subscriptions")
      return SUBSCRIPTIONS;
    if (parts.length === 1 && parts[0] === "compose")
      return COMPOSE;
    if (parts.length === 1 && parts[0] === "search")
      return SEARCH;
    if (parts.length === 2 && parts[0] === "conversation")
      return CONVERSATION;
    if (parts.length === 3 && parts[0] === "search" && parts[1] === "conversation") {
      return SEARCH_CONVERSATION;
    }
    return INBOX;
  }
  function getShellCacheKey(pathname) {
    if (pathname.endsWith(".html") && pathname !== "/index.html")
      return null;
    let parts;
    try {
      parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);
    } catch {
      return null;
    }
    if (parts.some((part) => part.startsWith("(")))
      return null;
    if (pathname === "/settings" || pathname.startsWith("/settings/"))
      return pathname;
    const route = getShellRoute(pathname);
    if (route === INBOX && parts.length > 1 && !(parts.length === 2 && parts[0] === "label"))
      return null;
    return route.asset;
  }

  // worker/service-worker.js
  var CACHE_NAME = "inbox-v4";
  var SHELL_KEY = "/index.html";
  var MAX_ENTRIES = 150;
  var APP_SHELL = ["/", "/index.html", "/manifest.json"];
  self.addEventListener("install", (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).catch((err) => {
        console.warn("[SW] Failed to pre-cache app shell:", err);
      });
    }));
    self.skipWaiting();
  });
  self.addEventListener("activate", (event) => {
    event.waitUntil(caches.keys().then((keys) => {
      return Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    }));
    self.clients.claim();
  });
  function getStrategy(request) {
    const url = new URL(request.url);
    if (request.method !== "GET")
      return "network-only";
    if (url.origin !== self.location.origin)
      return "network-only";
    if (request.headers.has("authorization"))
      return "network-only";
    if (url.pathname.startsWith("/api/"))
      return "network-only";
    if (url.pathname.match(/\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|gif|svg|ico|webp)$/) || url.pathname.startsWith("/_expo/") || url.pathname.startsWith("/assets/")) {
      return "stale-while-revalidate";
    }
    if (request.mode === "navigate")
      return "navigation";
    return "network-first";
  }
  async function trimCache(cache) {
    const keys = await cache.keys();
    const excess = keys.length - MAX_ENTRIES;
    for (let i = 0;i < excess; i++) {
      if (new URL(keys[i].url).pathname !== SHELL_KEY)
        await cache.delete(keys[i]);
    }
  }
  async function navigation(request) {
    const shellKey = getShellCacheKey(new URL(request.url).pathname);
    try {
      const response = await fetch(request);
      const finalUrl = new URL(response.url || request.url);
      const finalKey = finalUrl.origin === self.location.origin ? getShellCacheKey(finalUrl.pathname) : null;
      if (finalKey && response.ok && response.headers.get("content-type")?.includes("text/html")) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(finalKey, response.clone());
        trimCache(cache);
      }
      return response;
    } catch {
      const shell = shellKey ? await caches.match(shellKey) : null;
      if (shell)
        return shell;
      return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
    }
  }
  async function networkFirst(request, cacheName) {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(cacheName);
        await cache.put(request, response.clone());
        trimCache(cache);
      }
      return response;
    } catch {
      const cached = await caches.match(request);
      if (cached)
        return cached;
      return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
    }
  }
  async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    const fetchPromise = fetch(request).then((response) => {
      if (response.ok) {
        cache.put(request, response.clone()).then(() => trimCache(cache));
      }
      return response;
    }).catch(() => null);
    if (cached)
      return cached;
    const fresh = await fetchPromise;
    if (fresh)
      return fresh;
    return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
  }
  self.addEventListener("fetch", (event) => {
    const strategy = getStrategy(event.request);
    if (strategy === "network-only")
      return;
    if (strategy === "stale-while-revalidate") {
      event.respondWith(staleWhileRevalidate(event.request));
      return;
    }
    if (strategy === "navigation") {
      event.respondWith(navigation(event.request));
      return;
    }
    event.respondWith(networkFirst(event.request, CACHE_NAME));
  });
  var FALLBACK_STRINGS = {
    en: { title: "New email", body: "You have a new message." },
    es: { title: "Correo nuevo", body: "Tienes un mensaje nuevo." },
    ca: { title: "Correu nou", body: "Tens un missatge nou." },
    de: { title: "Neue E-Mail", body: "Du hast eine neue Nachricht." },
    fr: { title: "Nouveau courriel", body: "Tu as un nouveau message." },
    it: { title: "Nuova email", body: "Hai un nuovo messaggio." },
    pt: { title: "Novo email", body: "Tens uma nova mensagem." },
    ja: { title: "新着メール", body: "新しいメッセージがあります。" },
    ko: { title: "새 메일", body: "새 메시지가 있어요." },
    zh: { title: "新邮件", body: "你有一封新邮件。" },
    ar: { title: "رسالة جديدة", body: "لديك رسالة جديدة." }
  };
  function fallbackStrings() {
    const language = (self.navigator?.language || "en").slice(0, 2).toLowerCase();
    return FALLBACK_STRINGS[language] || FALLBACK_STRINGS.en;
  }
  function notificationPayload(data) {
    const fallback = fallbackStrings();
    const payload = data && typeof data === "object" ? data : {};
    const messageId = typeof payload.messageId === "string" ? payload.messageId : null;
    const sender = typeof payload.sender === "string" ? payload.sender : fallback.title;
    const subject = typeof payload.subject === "string" ? payload.subject : "";
    const body = typeof payload.body === "string" ? payload.body : subject;
    return {
      title: sender,
      options: {
        body: body || fallback.body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: messageId ? `inbox-message-${messageId}` : "inbox-message",
        renotify: Boolean(messageId),
        data: { messageId }
      }
    };
  }
  self.addEventListener("push", (event) => {
    let data = {};
    try {
      data = event.data ? event.data.json() : {};
    } catch {
      data = { body: event.data ? event.data.text() : "" };
    }
    const notification = notificationPayload(data);
    event.waitUntil(self.registration.showNotification(notification.title, notification.options));
  });
  self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const messageId = event.notification.data?.messageId;
    const target = messageId ? new URL(`/conversation/${encodeURIComponent(messageId)}`, self.location.origin).href : new URL("/", self.location.origin).href;
    event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.startsWith(self.location.origin));
      if (existing && "navigate" in existing) {
        return existing.navigate(target).then((client) => (client ?? existing).focus()).catch(() => self.clients.openWindow(target));
      }
      return self.clients.openWindow(target);
    }));
  });
  self.addEventListener("message", (event) => {
    if (event.data?.type === "SKIP_WAITING") {
      self.skipWaiting();
    }
  });
})();
