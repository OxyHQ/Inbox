/**
 * `useCidResolver` — inline images (`cid:` references) resolved to signed File
 * Manager URLs, per displayed message.
 *
 * The maps used to be cleared by an effect when the displayed message changed,
 * so the new message rendered once with the previous message's maps and then
 * again without them. These pin that the first render after a change has none,
 * and that a lookup finishing after the user moved on is dropped.
 */

import { act, renderHook } from '@testing-library/react';
import type { OxyServices } from '@oxy.so/core';

import { useCidResolver } from '@/hooks/useCidResolver';
import { MessageSchema, type Message } from '@/schemas/emailSchemas';
import { wireMessage } from '../fixtures/wire';

const inlineImage = {
  fileId: 'file-logo',
  name: 'logo.png',
  contentType: 'image/png',
  size: 1200,
  contentId: '<logo@example>',
  isInline: true,
};

function messageWithImage(id: string): Message {
  return MessageSchema.parse(
    wireMessage({
      _id: id,
      id,
      html: '<p>Hi</p><img src="cid:logo@example">',
      attachments: [inlineImage],
    }),
  );
}

function services(url: (fileId: string) => Promise<string>): OxyServices {
  return { assets: { url: jest.fn(url) } } as unknown as OxyServices;
}

async function settle() {
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

const thread = [messageWithImage('m1'), messageWithImage('m2')];

it('replaces cid: references with the signed URLs', async () => {
  const oxy = services(async (fileId) => `https://files.example/${fileId}`);
  const { result } = renderHook(() => useCidResolver(thread, oxy, 'm1'));
  await settle();

  expect(result.current.m1).toBe('<p>Hi</p><img src="https://files.example/file-logo">');
  expect(result.current.m2).toBe('<p>Hi</p><img src="https://files.example/file-logo">');
});

it('does not render the next message with the previous message’s maps', async () => {
  const oxy = services(async (fileId) => `https://files.example/${fileId}`);
  const renders: Record<string, string>[] = [];
  const { rerender } = renderHook(
    ({ resetKey }) => {
      const resolved = useCidResolver(thread, oxy, resetKey);
      renders.push(resolved);
      return resolved;
    },
    { initialProps: { resetKey: 'm1' } },
  );
  await settle();
  expect(renders.at(-1)?.m1).toContain('https://files.example/file-logo');

  const before = renders.length;
  rerender({ resetKey: 'm2' });

  // The first render for the new message: nothing resolved for it yet.
  expect(renders[before].m1).toContain('cid:logo@example');
  expect(renders[before].m2).toContain('cid:logo@example');

  await settle();
  expect(renders.at(-1)?.m2).toContain('https://files.example/file-logo');
});

it('drops a lookup that finishes after the displayed message changed', async () => {
  const lookups: { fileId: string; resolve: (url: string) => void }[] = [];
  const oxy = services(
    (fileId) =>
      new Promise<string>((resolve) => {
        lookups.push({ fileId, resolve });
      }),
  );
  const first = [messageWithImage('a1')];
  const second = [messageWithImage('b1')];
  const { result, rerender } = renderHook(
    ({ messages, resetKey }) => useCidResolver(messages, oxy, resetKey),
    { initialProps: { messages: first, resetKey: 'a1' } },
  );
  await settle();
  expect(lookups).toHaveLength(1);

  rerender({ messages: second, resetKey: 'b1' });
  await settle();
  expect(lookups).toHaveLength(2);

  // The first message's lookup lands late, then the second one's.
  await act(async () => {
    lookups[0].resolve('https://files.example/stale');
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
  expect(result.current.b1).toContain('cid:logo@example');
  expect(result.current.a1).toBeUndefined();

  await act(async () => {
    lookups[1].resolve('https://files.example/fresh');
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
  expect(result.current.b1).toBe('<p>Hi</p><img src="https://files.example/fresh">');
});
