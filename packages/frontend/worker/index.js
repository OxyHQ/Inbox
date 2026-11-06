import { getShellRoute } from '../constants/shell-routes.js';

export default {
  fetch(request, env) {
    const url = new URL(request.url);
    const route = getShellRoute(url.pathname);
    // Only dynamic conversation documents need an asset lookup. Static routes,
    // methods, headers and the browser's public URL retain their usual behavior.
    if (
      (request.method === 'GET' || request.method === 'HEAD') &&
      route.pathname.includes('[id]')
    ) {
      url.pathname = encodeURI(route.asset);
      url.search = '';
      return env.ASSETS.fetch(new Request(url, request));
    }
    return env.ASSETS.fetch(request);
  },
};
