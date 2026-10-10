import type { Message } from '@/schemas/emailSchemas';

/**
 * Where opening a message goes. A draft is not something to read: it opens in
 * the composer, to be finished and sent. It used to open read-only in the
 * conversation view, whose only actions were Reply and Forward — so a saved
 * draft could never be sent.
 */
export function messageRoute(
  message: Pick<Message, '_id' | 'flags'>,
  conversationPath: '/conversation/[id]' | '/search/conversation/[id]' = '/conversation/[id]',
) {
  if (message.flags.draft) {
    return { pathname: '/compose', params: { draftId: message._id } } as const;
  }
  return { pathname: conversationPath, params: { id: message._id } } as const;
}
