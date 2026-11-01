import type { InferenceOwner } from '@/hooks/queries/useObservedInferenceOwner';

function aborted(): Error {
  const error = new Error('Inference session changed.');
  error.name = 'AbortError';
  return error;
}

/** Fence a request with its observed account/session and the query's lifetime. */
export async function runObservedInference<T>(
  owner: InferenceOwner,
  signal: AbortSignal,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (!owner.isCurrent()) throw aborted();
  const controller = new AbortController();
  let offToken = () => {};
  let offRuntime = () => {};
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    offToken();
    offRuntime();
    signal.removeEventListener('abort', stop);
  };
  const stop = () => {
    controller.abort();
    dispose();
  };
  const check = () => {
    if (!owner.isCurrent()) stop();
  };
  offToken = owner.http.addTokenChangeListener(check);
  offRuntime = owner.runtime.subscribe(check);
  signal.addEventListener('abort', stop, { once: true });
  if (signal.aborted) stop();
  check();
  try {
    if (controller.signal.aborted) throw aborted();
    const result = await run(controller.signal);
    if (controller.signal.aborted || !owner.isCurrent()) throw aborted();
    return result;
  } finally {
    dispose();
  }
}
