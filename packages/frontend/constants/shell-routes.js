/**
 * Public document families shared by Expo hydration, the edge Worker and the
 * offline worker. Message IDs never enter these documents or cache keys.
 * Other dynamic routes still hydrate the index fallback before mounting.
 */
const INBOX = { pathname: '/', asset: '/index.html', renderRoute: false, emptyDetail: true };
const COMPOSE = { pathname: '/compose', asset: '/compose', renderRoute: true, emptyDetail: false };
const SEARCH = { pathname: '/search', asset: '/search/', renderRoute: true, emptyDetail: true };
const CONVERSATION = {
  pathname: '/conversation/[id]',
  asset: '/conversation/[id]',
  renderRoute: true,
  emptyDetail: false,
};
const SEARCH_CONVERSATION = {
  pathname: '/search/conversation/[id]',
  asset: '/search/conversation/[id]',
  renderRoute: true,
  emptyDetail: false,
};

const SUBSCRIPTIONS = {
  pathname: '/',
  asset: '/subscriptions',
  renderRoute: false,
  emptyDetail: false,
};

/** Export validation uses the same document list as runtime routing. */
export const SHELL_DOCUMENT_ASSETS = [
  INBOX,
  COMPOSE,
  SEARCH,
  CONVERSATION,
  SEARCH_CONVERSATION,
  SUBSCRIPTIONS,
].map((route) => route.asset);

/** @param {string} pathname */
export function getShellRoute(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 1 && parts[0] === 'subscriptions') return SUBSCRIPTIONS;
  if (parts.length === 1 && parts[0] === 'compose') return COMPOSE;
  if (parts.length === 1 && parts[0] === 'search') return SEARCH;
  if (parts.length === 2 && parts[0] === 'conversation') return CONVERSATION;
  if (parts.length === 3 && parts[0] === 'search' && parts[1] === 'conversation') {
    return SEARCH_CONVERSATION;
  }
  return INBOX;
}

/** Public HTML cache key; settings keep their individual exported documents. @param {string} pathname */
export function getShellCacheKey(pathname) {
  // Redirect aliases are cached under the final clean URL; offline aliases fail closed.
  if (pathname.endsWith('.html') && pathname !== '/index.html') return null;
  let parts;
  try {
    parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    return null;
  }
  // Expo also exports internal group aliases. They are not public offline routes.
  if (parts.some((part) => part.startsWith('('))) return null;
  if (pathname === '/settings' || pathname.startsWith('/settings/')) return pathname;
  const route = getShellRoute(pathname);
  if (route === INBOX && parts.length > 1 && !(parts.length === 2 && parts[0] === 'label'))
    return null;
  return route.asset;
}
