// inbo.sh is Inbosh's address. The old host answers every request with a
// permanent redirect to the same path there; a 308 keeps the method.
const LEGACY_HOST = 'inbox.oxy.so';
const CANONICAL_ORIGIN = 'https://inbo.sh';

export default {
  fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === LEGACY_HOST) {
      return Response.redirect(`${CANONICAL_ORIGIN}${url.pathname}${url.search}`, 308);
    }
    return env.ASSETS.fetch(request);
  },
};
