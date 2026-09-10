import {
  runInboxCompose,
  inboxLocalDayWindow,
  runInboxNaturalSearch,
  runInboxSmartReplies,
  runInboxThreadSummary,
  streamInboxDailyBrief,
  streamInboxDraft,
} from '@/services/inboxInferenceApi';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const requestId = 'req_01a06477';

function http() {
  return {
    post: jest.fn(),
    requestAuthenticatedResponse: jest.fn(),
  };
}

async function collect(stream: AsyncGenerator<string>): Promise<string[]> {
  const values: string[] = [];
  for await (const value of stream) values.push(value);
  return values;
}

function sseResponse(
  body: string | Uint8Array,
  contentType = 'text/event-stream; charset=utf-8',
): Response {
  const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : body;
  return {
    ok: true,
    status: 200,
    headers: { get: (name: string) => name.toLowerCase() === 'content-type' ? contentType : null },
    body: null,
    arrayBuffer: async () => bytes.slice().buffer,
  } as unknown as Response;
}

function readerSseResponse(chunks: (string | Uint8Array)[]): {
  response: Response;
  read: jest.Mock;
  cancel: jest.Mock;
  releaseLock: jest.Mock;
} {
  const reads = chunks.map((chunk) => ({
    done: false as const,
    value: typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk,
  }));
  const read = jest.fn();
  for (const value of reads) read.mockResolvedValueOnce(value);
  read.mockResolvedValueOnce({ done: true as const, value: undefined });
  const cancel = jest.fn(async () => undefined);
  const releaseLock = jest.fn();
  return {
    response: {
      ok: true,
      status: 200,
      headers: { get: (name: string) => name.toLowerCase() === 'content-type' ? 'text/event-stream' : null },
      body: { getReader: () => ({ read, cancel, releaseLock }) },
    } as unknown as Response,
    read,
    cancel,
    releaseLock,
  };
}

describe('Inbox point-inference API client', () => {
  it('computes exact UTC bounds for the current local calendar day', () => {
    const now = new Date(2026, 8, 3, 12, 34, 56);
    expect(inboxLocalDayWindow(now)).toEqual({
      day: '2026-09-03',
      startAt: new Date(2026, 8, 3).toISOString(),
      endAt: new Date(2026, 8, 4).toISOString(),
    });
  });

  it('uses only the bounded Oxy routes and validates their response contracts', async () => {
    const client = http();
    client.post
      .mockResolvedValueOnce({ schemaVersion: 1, requestId, text: 'Polished' })
      .mockResolvedValueOnce({
        query: { unread: true, mailbox: 'inbox' },
        interpretation: 'Unread inbox mail',
      })
      .mockResolvedValueOnce({ replies: ['Yes', 'No'] })
      .mockResolvedValueOnce({
        summary: 'Summary',
        keyPoints: ['Point'],
        actionItems: [{ text: 'Reply', owner: null, deadline: null }],
      });

    await expect(runInboxCompose(client as never, {
      operation: 'polish',
      text: 'Draft',
    })).resolves.toMatchObject({ text: 'Polished' });
    await expect(runInboxNaturalSearch(client as never, 'unread mail')).resolves.toMatchObject({
      query: { unread: true },
    });
    await expect(runInboxSmartReplies(client as never, 'message/with slash')).resolves.toEqual({
      replies: ['Yes', 'No'],
    });
    await expect(runInboxThreadSummary(client as never, 'message-1')).resolves.toMatchObject({
      summary: 'Summary',
    });

    expect(client.post.mock.calls).toEqual([
      ['/email/ai/compose', { operation: 'polish', text: 'Draft' }],
      ['/email/ai/natural-search', { query: 'unread mail' }],
      ['/email/ai/messages/message%2Fwith%20slash/smart-replies', {}],
      ['/email/ai/messages/message-1/thread-summary', {}],
    ]);
  });

  it('keeps point inference on Oxy and agent chat on Alia without the retired proxy', () => {
    const frontendRoot = resolve(__dirname, '../..');
    const source = [
      'hooks/mutations/useAiCompose.ts',
      'hooks/queries/useDailyBrief.ts',
      'hooks/queries/useNaturalLanguageSearch.ts',
      'hooks/queries/useSmartReplies.ts',
      'hooks/queries/useThreadSummary.ts',
      'services/inboxInferenceApi.ts',
    ].map((path) => readFileSync(resolve(frontendRoot, path), 'utf8')).join('\n');
    const inboxList = readFileSync(resolve(frontendRoot, 'components/InboxList.tsx'), 'utf8');
    const dailyBriefHook = readFileSync(
      resolve(frontendRoot, 'hooks/queries/useDailyBrief.ts'),
      'utf8',
    );
    const pointInferenceUi = [
      'components/AiComposeToolbar.tsx',
      'components/SmartReplyChips.tsx',
      'contexts/inbox-prefs-context.tsx',
      'hooks/queries/queryKeys.ts',
    ].map((path) => readFileSync(resolve(frontendRoot, path), 'utf8')).join('\n');
    const localeRoot = resolve(frontendRoot, 'lib/i18n/locales');
    const localeSource = readdirSync(localeRoot)
      .filter((path) => path.endsWith('.ts'))
      .map((path) => readFileSync(resolve(localeRoot, path), 'utf8'))
      .join('\n');
    const headers = JSON.parse(
      readFileSync(resolve(frontendRoot, 'oxy.pages-headers.json'), 'utf8'),
    ) as { csp?: { connectSrc?: string[] } };

    expect(source).not.toMatch(/\/alia\/chat\/completions|ALIA_API_KEY|aliaChatCompletion/);
    expect(source).not.toMatch(/\bfetch\(|getAccessToken\(\)/);
    expect(source).toContain('requestAuthenticatedResponse');
    for (const path of [
      '/email/ai/compose',
      '/email/ai/daily-brief',
      '/email/ai/natural-search',
      'smart-replies',
      'thread-summary',
    ]) {
      expect(source).toContain(path);
    }
    expect(inboxList).toContain('<AliaChatSheet');
    expect(inboxList).not.toMatch(/ALIA_PROXY_API_URL|apiUrl=\{ALIA_PROXY_API_URL\}|model="alia-lite"/);
    expect(dailyBriefHook).not.toMatch(/messages\.length|Message\[\]/);
    expect(pointInferenceUi).not.toMatch(/\bAlia\b|'alia'/);
    expect(pointInferenceUi).toContain('bounded email context to Kaana');
    expect(localeSource).not.toMatch(
      /drafted by Alia|Daily Brief and Smart Reply use Alia|conversation to Alia for summarization|Alia will draft it/,
    );
    expect(headers.csp?.connectSrc).toEqual(expect.arrayContaining([
      'https://api.alia.onl',
      'wss://api.alia.onl',
      'wss://livekit.oxy.so',
    ]));
  });

  it('fails closed on malformed non-streaming data', async () => {
    const client = http();
    client.post.mockResolvedValue({
      schemaVersion: 1,
      requestId,
      text: 'valid-looking',
      providerSecret: 'must-not-be-accepted',
    });
    await expect(runInboxCompose(client as never, {
      operation: 'draft',
      prompt: 'Write a note',
      tone: 'professional',
    })).rejects.toThrow('invalid response');
  });

  it('streams compose and daily-brief text through Oxy with the SDK token', async () => {
    const client = http();
    client.requestAuthenticatedResponse.mockResolvedValue(sseResponse([
      'data: {"type":"delta","text":"Hello"}',
      '',
      `data: {"type":"done","requestId":"${requestId}"}`,
      '',
      '',
    ].join('\n')));

    await expect(collect(streamInboxDraft(client as never, {
      operation: 'draft',
      prompt: 'Write a note',
      tone: 'friendly',
    }))).resolves.toEqual(['Hello']);
    const dayWindow = {
      startAt: '2026-09-02T21:00:00.000Z',
      endAt: '2026-09-03T21:00:00.000Z',
    };
    await expect(collect(streamInboxDailyBrief(client as never, dayWindow))).resolves.toEqual(['Hello']);

    expect(client.requestAuthenticatedResponse).toHaveBeenNthCalledWith(1, {
      method: 'POST',
      url: '/email/ai/compose',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        operation: 'draft',
        prompt: 'Write a note',
        tone: 'friendly',
        stream: true,
      }),
      signal: undefined,
    });
    expect(client.requestAuthenticatedResponse).toHaveBeenNthCalledWith(2, {
      method: 'POST',
      url: '/email/ai/daily-brief',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({ ...dayWindow, stream: true }),
      signal: undefined,
    });
  });

  it('rejects truncated, malformed and post-terminal streams', async () => {
    const client = http();
    client.requestAuthenticatedResponse.mockResolvedValueOnce(
      sseResponse('data: {"type":"delta","text":"partial"}\n\n'),
    );
    const window = {
      startAt: '2026-09-02T21:00:00.000Z',
      endAt: '2026-09-03T21:00:00.000Z',
    };
    await expect(collect(streamInboxDailyBrief(client as never, window))).rejects.toThrow(
      'ended before completion',
    );

    client.requestAuthenticatedResponse.mockResolvedValueOnce(sseResponse('data: {not-json}\n\n'));
    await expect(collect(streamInboxDailyBrief(client as never, window))).rejects.toThrow(
      'invalid stream',
    );

    client.requestAuthenticatedResponse.mockResolvedValueOnce(sseResponse([
      `data: {"type":"done","requestId":"${requestId}"}`,
      '',
      'data: {"type":"delta","text":"late"}',
      '',
      '',
    ].join('\n')));
    await expect(collect(streamInboxDailyBrief(client as never, window))).rejects.toThrow(
      'data after completion',
    );
  });

  it('parses real reader chunk boundaries and releases the reader', async () => {
    const client = http();
    const stream = readerSseResponse([
      'data: {"type":"del',
      'ta","text":"Hello"}\r\n\r\n',
      `data: {"type":"done","requestId":"${requestId}"}\n\n`,
    ]);
    client.requestAuthenticatedResponse.mockResolvedValue(stream.response);

    const window = {
      startAt: '2026-09-02T21:00:00.000Z',
      endAt: '2026-09-03T21:00:00.000Z',
    };
    await expect(collect(streamInboxDailyBrief(client as never, window))).resolves.toEqual(['Hello']);
    expect(stream.read).toHaveBeenCalledTimes(3);
    expect(stream.cancel).toHaveBeenCalledTimes(1);
    expect(stream.releaseLock).toHaveBeenCalledTimes(1);

    const incomplete = readerSseResponse(['data: {"type":"delta","text":"partial"}\n\n']);
    client.requestAuthenticatedResponse.mockResolvedValue(incomplete.response);
    await expect(collect(streamInboxDailyBrief(client as never, window))).rejects.toThrow(
      'ended before completion',
    );
    expect(incomplete.cancel).toHaveBeenCalledTimes(1);
    expect(incomplete.releaseLock).toHaveBeenCalledTimes(1);

    const postTerminal = readerSseResponse([[
      `data: {"type":"done","requestId":"${requestId}"}`,
      '',
      'data: {"type":"delta","text":"late"}',
      '',
      '',
    ].join('\n')]);
    client.requestAuthenticatedResponse.mockResolvedValue(postTerminal.response);
    await expect(collect(streamInboxDailyBrief(client as never, window))).rejects.toThrow(
      'data after completion',
    );
    expect(postTerminal.cancel).toHaveBeenCalledTimes(1);
    expect(postTerminal.releaseLock).toHaveBeenCalledTimes(1);
  });

  it('fails closed on EOF inside a frame and invalid UTF-8', async () => {
    const client = http();
    const window = {
      startAt: '2026-09-02T21:00:00.000Z',
      endAt: '2026-09-03T21:00:00.000Z',
    };

    client.requestAuthenticatedResponse.mockResolvedValueOnce(
      sseResponse(`data: {"type":"done","requestId":"${requestId}"}`),
    );
    await expect(collect(streamInboxDailyBrief(client as never, window))).rejects.toThrow(
      'ended inside an SSE frame',
    );

    client.requestAuthenticatedResponse.mockResolvedValueOnce(
      sseResponse(Uint8Array.from([0xc3, 0x28])),
    );
    await expect(collect(streamInboxDailyBrief(client as never, window))).rejects.toThrow(
      'invalid UTF-8',
    );

    const invalidReader = readerSseResponse([Uint8Array.from([0xc3, 0x28])]);
    client.requestAuthenticatedResponse.mockResolvedValueOnce(invalidReader.response);
    await expect(collect(streamInboxDailyBrief(client as never, window))).rejects.toThrow(
      'invalid UTF-8',
    );
    expect(invalidReader.cancel).toHaveBeenCalledTimes(1);
    expect(invalidReader.releaseLock).toHaveBeenCalledTimes(1);

    const terminal = new TextEncoder().encode(
      `data: {"type":"done","requestId":"${requestId}"}\n\n`,
    );
    const incompleteAfterTerminal = new Uint8Array(terminal.byteLength + 1);
    incompleteAfterTerminal.set(terminal);
    incompleteAfterTerminal[terminal.byteLength] = 0xc3;
    const invalidTerminalReader = readerSseResponse([incompleteAfterTerminal]);
    client.requestAuthenticatedResponse.mockResolvedValueOnce(invalidTerminalReader.response);
    await expect(collect(streamInboxDailyBrief(client as never, window))).rejects.toThrow(
      'invalid UTF-8',
    );
    expect(invalidTerminalReader.cancel).toHaveBeenCalledTimes(1);
    expect(invalidTerminalReader.releaseLock).toHaveBeenCalledTimes(1);
  });

  it('fails closed on an error frame, invalid MIME and oversized line counts', async () => {
    const client = http();
    const window = {
      startAt: '2026-09-02T21:00:00.000Z',
      endAt: '2026-09-03T21:00:00.000Z',
    };
    client.requestAuthenticatedResponse.mockResolvedValueOnce(sseResponse([
      `data: {"type":"error","error":{"schemaVersion":1,"code":"service_unavailable","message":"safe","retryable":true,"requestId":"${requestId}"}}`,
      '',
      '',
    ].join('\n')));
    await expect(collect(streamInboxDailyBrief(client as never, window))).rejects.toThrow(
      'could not complete',
    );

    client.requestAuthenticatedResponse.mockResolvedValueOnce(sseResponse('not SSE', 'application/json'));
    await expect(collect(streamInboxDailyBrief(client as never, window))).rejects.toThrow(
      'invalid stream type',
    );

    client.requestAuthenticatedResponse.mockResolvedValueOnce(sseResponse('\n'.repeat(4_097)));
    await expect(collect(streamInboxDailyBrief(client as never, window))).rejects.toThrow(
      'safety limit',
    );
  });
});
