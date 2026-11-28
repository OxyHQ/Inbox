// inbo.sh is Inbosh's address. The old host answers every request with a
// permanent redirect to the same path there; a 308 keeps the method.
const LEGACY_HOST = 'inbox.oxy.so';
const CANONICAL_ORIGIN = 'https://inbo.sh';

// Everything the Expo export writes under `/_expo/static/` is named by a hash of
// its bytes, and `_headers` (scripts/write-pages-headers.ts) marks it
// `immutable` for a year. The assets binding's single-page-application fallback
// answers a hashed name this deploy does not have (an old tab asking for the
// last release's chunk) with `index.html`, and `_headers` matches on the request
// path, so that rule would pin the HTML to the script's name. Such a miss is a
// 404 that nothing keeps.
const HASHED_PREFIX = '/_expo/static/';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === LEGACY_HOST) {
      return Response.redirect(`${CANONICAL_ORIGIN}${url.pathname}${url.search}`, 308);
    }
    const response = await env.ASSETS.fetch(request);
    if (
      url.pathname.startsWith(HASHED_PREFIX) &&
      (response.headers.get('content-type') ?? '').startsWith('text/html')
    ) {
      return new Response('Not found', {
        status: 404,
        headers: { 'cache-control': 'no-store', 'content-type': 'text/plain' },
      });
    }
    return response;
  },
};
