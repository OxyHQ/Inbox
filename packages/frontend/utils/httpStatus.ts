/**
 * The HTTP status of a failed API call, or `null` when the error did not come
 * from a response (a network failure, a timeout, a schema mismatch).
 *
 * `@oxy.so/core`'s HttpService puts it on `status`, and on `response.status`
 * too; older SDK builds used `statusCode`. Reading all three keeps a check like
 * "was this a 409?" from silently failing when the error shape moves.
 */
export function httpStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const candidate = error as {
    status?: unknown;
    statusCode?: unknown;
    response?: { status?: unknown } | null;
  };
  for (const value of [candidate.status, candidate.statusCode, candidate.response?.status]) {
    if (typeof value === 'number' && value > 0) return value;
  }
  return null;
}
