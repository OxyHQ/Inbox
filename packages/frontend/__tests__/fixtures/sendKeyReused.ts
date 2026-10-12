/**
 * What oxy-api answers a send whose Idempotency-Key already sent a DIFFERENT
 * message (OxyHQ/oxy#1676): `ApiError.toJSON()` of a 422. `details` may be
 * overridden or extended — `deliveryState: undefined` is an older API.
 */
export function keyReusedBody(details: Record<string, unknown> = {}) {
  return {
    error: 'VALIDATION_ERROR',
    message:
      'This Idempotency-Key was already used for a different message. Send this one with a new key.',
    details: {
      reason: 'idempotency_key_reused',
      id: 'sent-row-1',
      messageId: '<inbox-send-1@oxy.so>',
      deliveryState: 'sent',
      scheduledAt: null,
      ...details,
    },
  };
}

/**
 * That answer as `@oxy.so/core`'s HttpService throws it: an `Error` carrying the
 * status, the parsed `code`/`details`, and the raw body on `response.data`.
 */
export function keyReusedError(details: Record<string, unknown> = {}) {
  const body = keyReusedBody(details);
  return Object.assign(new Error(body.message), {
    status: 422,
    code: body.error,
    details: body.details,
    response: { status: 422, statusText: 'Unprocessable Entity', data: body },
  });
}
