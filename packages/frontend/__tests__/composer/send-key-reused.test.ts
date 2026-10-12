/**
 * `alreadySentUnderKey` — a send refused because its key already sent a
 * different message.
 *
 * A composer restored after a crash resumes its session's key and renders the
 * body again, so the bytes differ from what the key sent before the crash. The
 * API used to answer that with the first send; since OxyHQ/oxy#1676 it refuses
 * it with 422. The composer must read that as "already sent", and only that:
 * any other 422 is a real refusal.
 */

import { OxyServices } from '@oxy.so/core';

import { createEmailApi } from '@/services/emailApi';
import { alreadySentUnderKey } from '@/utils/sendIdempotency';
import { keyReusedBody, keyReusedError } from '../fixtures/sendKeyReused';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 422 ? 'Unprocessable Entity' : 'Error',
    headers: {
      get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
    clone() {
      return this;
    },
  };
}

describe('the error the SDK throws for the 422', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  async function sendRefusedWith(status: number, body: unknown): Promise<unknown> {
    globalThis.fetch = jest.fn(async () => jsonResponse(status, body)) as never;
    const oxy = new OxyServices({ baseURL: 'https://api.test' });
    const api = createEmailApi(oxy.http);
    try {
      await api.sendMessage({
        to: [{ address: 'ann@example.com' }],
        subject: 'Plan',
        html: '<p>Re-rendered after a crash</p>',
        idempotencyKey: 'inbox-send-1',
      });
    } catch (error) {
      return error;
    }
    throw new Error('the send did not fail');
  }

  it('names the message already sent', async () => {
    const error = await sendRefusedWith(422, keyReusedBody('sent-row-1'));
    expect(alreadySentUnderKey(error)).toEqual({
      id: 'sent-row-1',
      messageId: '<inbox-send-1@oxy.so>',
    });
    // A refusal, not a transient failure: the SDK's retry does not resend it.
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('is still "already sent" when the API cannot name the row', async () => {
    const error = await sendRefusedWith(422, keyReusedBody(null));
    expect(alreadySentUnderKey(error)).toEqual({ id: null, messageId: '<inbox-send-1@oxy.so>' });
  });

  it('is not any other 422', async () => {
    const error = await sendRefusedWith(422, {
      error: 'VALIDATION_ERROR',
      message: 'Invalid recipient',
      details: { field: 'to' },
    });
    expect(alreadySentUnderKey(error)).toBeNull();
  });
});

describe('alreadySentUnderKey', () => {
  it('reads the body from the response when the error carries no details', () => {
    const { details: _details, ...withoutDetails } = keyReusedError();
    expect(alreadySentUnderKey(withoutDetails)).toEqual({
      id: 'sent-row-1',
      messageId: '<inbox-send-1@oxy.so>',
    });
  });

  it('reads a status carried only on the response', () => {
    const error = Object.assign(new Error('refused'), {
      response: { status: 422, data: keyReusedBody() },
    });
    expect(alreadySentUnderKey(error)).toEqual({
      id: 'sent-row-1',
      messageId: '<inbox-send-1@oxy.so>',
    });
  });

  it('rejects the reason under any other status', () => {
    expect(
      alreadySentUnderKey({ ...keyReusedError(), status: 409, response: undefined }),
    ).toBeNull();
    expect(
      alreadySentUnderKey({ ...keyReusedError(), status: 500, response: undefined }),
    ).toBeNull();
  });

  it('rejects a 422 without the reason', () => {
    expect(alreadySentUnderKey({ status: 422 })).toBeNull();
    expect(alreadySentUnderKey({ status: 422, details: { reason: 'something_else' } })).toBeNull();
    expect(alreadySentUnderKey({ status: 422, details: 'idempotency_key_reused' })).toBeNull();
  });

  it('rejects what is not an HTTP error', () => {
    expect(alreadySentUnderKey(new Error('timeout'))).toBeNull();
    expect(alreadySentUnderKey(null)).toBeNull();
    expect(alreadySentUnderKey(undefined)).toBeNull();
    expect(alreadySentUnderKey('422 idempotency_key_reused')).toBeNull();
  });

  it('drops an id or Message-ID that is not a string', () => {
    expect(
      alreadySentUnderKey({
        status: 422,
        details: { reason: 'idempotency_key_reused', id: 42, messageId: '' },
      }),
    ).toEqual({ id: null, messageId: null });
  });
});
