import { observeEdgeRequest } from '@oxy.so/telemetry/edge';

export default {
  fetch(request, env, ctx) {
    return observeEdgeRequest({ service: 'inbox', request, env, ctx, next: () => env.ASSETS.fetch(request) });
  },
};
