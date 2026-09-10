/**
 * Typed client for Inbox's bounded product-inference routes.
 *
 * These calls are deliberately owned by Oxy (`/email/ai/*`): Oxy authenticates
 * the human session, bounds the email data and prompt, attributes usage to the
 * exact Inbox application, and sends the authorized route to Kaana. Agent chat
 * remains a separate `@alia.onl/sdk` concern.
 */

import type { OxyServices } from '@oxy.so/core';
import {
  inboxInferenceStreamEventSchema,
  inboxInferenceTextResponseSchema,
  inboxNaturalSearchResponseSchema,
  inboxSmartRepliesResponseSchema,
  inboxThreadSummaryResponseSchema,
  type InboxComposeRequest,
  type InboxInferenceStreamEvent,
  type InboxInferenceTextResponse,
  type InboxNaturalSearchResponse,
  type InboxSmartRepliesResponse,
  type InboxThreadSummaryResponse,
} from '@oxy.so/contracts';
import type { z } from 'zod';

type HttpService = OxyServices['httpService'];

const COMPOSE_PATH = '/email/ai/compose';
const DAILY_BRIEF_PATH = '/email/ai/daily-brief';
const NATURAL_SEARCH_PATH = '/email/ai/natural-search';
const SSE_CONTENT_TYPE = 'text/event-stream';
const MAX_SSE_BYTES = 8 * 1024 * 1024;
const MAX_SSE_LINES = 4_096;
const MAX_SSE_FRAME_BYTES = 1024 * 1024;

type InboxDraftRequest = Extract<InboxComposeRequest, { operation: 'draft' }>;
export interface InboxDailyBriefWindow {
  day: string;
  startAt: string;
  endAt: string;
}
type InboxNonStreamingComposeRequest =
  | (Omit<InboxDraftRequest, 'stream'> & { stream?: false })
  | Exclude<InboxComposeRequest, InboxDraftRequest>;

function messagePath(messageId: string, operation: 'smart-replies' | 'thread-summary'): string {
  return `/email/ai/messages/${encodeURIComponent(messageId)}/${operation}`;
}

export function inboxLocalDayWindow(now: Date = new Date()): InboxDailyBriefWindow {
  const year = now.getFullYear();
  const monthIndex = now.getMonth();
  const dayOfMonth = now.getDate();
  const start = new Date(year, monthIndex, dayOfMonth);
  const end = new Date(year, monthIndex, dayOfMonth + 1);
  return {
    day: `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  };
}

function parseResponse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error('Inbox AI returned an invalid response.');
  return parsed.data;
}

async function postParsed<T>(
  http: HttpService,
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
): Promise<T> {
  return parseResponse(schema, await http.post<unknown>(path, body));
}

export function runInboxCompose(
  http: HttpService,
  request: InboxNonStreamingComposeRequest,
): Promise<InboxInferenceTextResponse> {
  return postParsed(http, COMPOSE_PATH, request, inboxInferenceTextResponseSchema);
}

export function runInboxNaturalSearch(
  http: HttpService,
  query: string,
): Promise<InboxNaturalSearchResponse> {
  return postParsed(http, NATURAL_SEARCH_PATH, { query }, inboxNaturalSearchResponseSchema);
}

export function runInboxSmartReplies(
  http: HttpService,
  messageId: string,
): Promise<InboxSmartRepliesResponse> {
  return postParsed(
    http,
    messagePath(messageId, 'smart-replies'),
    {},
    inboxSmartRepliesResponseSchema,
  );
}

export function runInboxThreadSummary(
  http: HttpService,
  messageId: string,
): Promise<InboxThreadSummaryResponse> {
  return postParsed(
    http,
    messagePath(messageId, 'thread-summary'),
    {},
    inboxThreadSummaryResponseSchema,
  );
}

function parseStreamFrame(raw: string): InboxInferenceStreamEvent {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new Error('Inbox AI returned an invalid stream.');
  }
  return parseResponse(inboxInferenceStreamEventSchema, value);
}

function abortError(): Error {
  const error = new Error('Inbox AI request was aborted.');
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw abortError();
}

function decodeUtf8(decoder: TextDecoder, bytes?: Uint8Array): string {
  try {
    return bytes ? decoder.decode(bytes, { stream: true }) : decoder.decode();
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new Error('Inbox AI returned invalid UTF-8.');
  }
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}

function splitNextSseBlock(buffer: string): { block: string; remainder: string } | null {
  const lf = buffer.indexOf('\n\n');
  const crlf = buffer.indexOf('\r\n\r\n');
  if (lf < 0 && crlf < 0) return null;
  if (crlf >= 0 && (lf < 0 || crlf < lf)) {
    return { block: buffer.slice(0, crlf), remainder: buffer.slice(crlf + 4) };
  }
  return { block: buffer.slice(0, lf), remainder: buffer.slice(lf + 2) };
}

function parseSseBlock(block: string): InboxInferenceStreamEvent | null {
  let data: string | null = null;
  for (const rawLine of block.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (line === '' || line.startsWith(':')) continue;
    if (!line.startsWith('data:') || data !== null) {
      throw new Error('Inbox AI returned an invalid stream.');
    }
    data = line.slice(5).trimStart();
  }

  if (data === null) return null;
  if (data.length === 0) throw new Error('Inbox AI returned an invalid stream.');
  return parseStreamFrame(data);
}

async function* streamInboxText(
  http: HttpService,
  path: string,
  body: unknown,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  throwIfAborted(signal);
  const response = await http.requestAuthenticatedResponse({
    method: 'POST',
    url: path,
    headers: {
      'Content-Type': 'application/json',
      Accept: SSE_CONTENT_TYPE,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (signal?.aborted) {
    await response.body?.cancel().catch(() => undefined);
    throw abortError();
  }

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`Inbox AI request failed (${response.status}).`);
  }
  if (response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== SSE_CONTENT_TYPE) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error('Inbox AI returned an invalid stream type.');
  }

  let receivedBytes = 0;
  let receivedLines = 0;
  const accountForChunk = (text: string, bytes: number): void => {
    receivedBytes += bytes;
    receivedLines += text.split('\n').length - 1;
    if (receivedBytes > MAX_SSE_BYTES || receivedLines > MAX_SSE_LINES) {
      throw new Error('Inbox AI stream exceeded its safety limit.');
    }
  };

  let sawDone = false;
  const handle = function* (event: InboxInferenceStreamEvent | null): Generator<string> {
    if (event === null) return;
    if (sawDone) throw new Error('Inbox AI returned data after completion.');
    if (event.type === 'delta') yield event.text;
    if (event.type === 'done') sawDone = true;
    if (event.type === 'error') throw new Error('Inbox AI could not complete the request.');
  };

  const consumeCompleteBlocks = function* (initial: string): Generator<string, string> {
    let remainder = initial;
    let next = splitNextSseBlock(remainder);
    while (next !== null) {
      remainder = next.remainder;
      for (const text of handle(parseSseBlock(next.block))) yield text;
      next = splitNextSseBlock(remainder);
    }
    if (utf8ByteLength(remainder) > MAX_SSE_FRAME_BYTES) {
      throw new Error('Inbox AI stream exceeded its safety limit.');
    }
    return remainder;
  };

  if (!response.body || typeof response.body.getReader !== 'function') {
    const bytes = new Uint8Array(await response.arrayBuffer());
    throwIfAborted(signal);
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const bodyText = decodeUtf8(decoder, bytes) + decodeUtf8(decoder);
    accountForChunk(bodyText, bytes.byteLength);
    const blocks = consumeCompleteBlocks(bodyText);
    let next = blocks.next();
    while (!next.done) {
      yield next.value;
      next = blocks.next();
    }
    if (next.value.trim().length > 0) {
      throw new Error('Inbox AI stream ended inside an SSE frame.');
    }
    if (!sawDone) throw new Error('Inbox AI stream ended before completion.');
    return;
  }

  const reader = response.body.getReader();
  const onAbort = (): void => {
    void reader.cancel().catch(() => undefined);
  };
  signal?.addEventListener('abort', onAbort, { once: true });
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let buffer = '';
  let completed = false;
  let decoderFlushed = false;
  try {
    while (true) {
      throwIfAborted(signal);
      const { done, value } = await reader.read();
      throwIfAborted(signal);
      if (done) break;
      const decoded = decodeUtf8(decoder, value);
      accountForChunk(decoded, value.byteLength);
      buffer += decoded;
      const blocks = consumeCompleteBlocks(buffer);
      let next = blocks.next();
      while (!next.done) {
        yield next.value;
        next = blocks.next();
      }
      buffer = next.value;
      if (sawDone) {
        buffer += decodeUtf8(decoder);
        decoderFlushed = true;
        if (buffer.trim().length > 0) {
          throw new Error('Inbox AI returned data after completion.');
        }
        await reader.cancel().catch(() => undefined);
        completed = true;
        break;
      }
    }
    if (!decoderFlushed) buffer += decodeUtf8(decoder);
    if (buffer.trim().length > 0) {
      throw new Error('Inbox AI stream ended inside an SSE frame.');
    }
    if (!sawDone) throw new Error('Inbox AI stream ended before completion.');
    completed = true;
  } finally {
    if (!completed) await reader.cancel().catch(() => undefined);
    signal?.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }
}

export function streamInboxDraft(
  http: HttpService,
  request: Omit<InboxDraftRequest, 'stream'>,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  return streamInboxText(http, COMPOSE_PATH, { ...request, stream: true }, signal);
}

export function streamInboxDailyBrief(
  http: HttpService,
  window: Pick<InboxDailyBriefWindow, 'startAt' | 'endAt'>,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  return streamInboxText(http, DAILY_BRIEF_PATH, { ...window, stream: true }, signal);
}
