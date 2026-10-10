/**
 * The draft id travels in the send body, where oxy-api's `sendMessageSchema`
 * reads it, and the idempotency key stays a header.
 */

import { createEmailApi } from '@/services/emailApi';

it('sends draftId in the body and the idempotency key as a header', async () => {
  const http = {
    post: jest
      .fn()
      .mockResolvedValue({ messageId: '<m@oxy.so>', queued: false, message: 'Message sent' }),
  };
  const api = createEmailApi(http as never);

  await api.sendMessage({
    to: [{ address: 'ann@example.com' }],
    subject: 'Plan',
    draftId: 'draft-1',
    idempotencyKey: 'inbox-send-1',
  });

  expect(http.post).toHaveBeenCalledWith(
    '/email/messages',
    { to: [{ address: 'ann@example.com' }], subject: 'Plan', draftId: 'draft-1' },
    expect.objectContaining({ headers: { 'Idempotency-Key': 'inbox-send-1' } }),
  );
});
