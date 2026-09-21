import {
  buildComposeDraftPayload,
  createDraftSaveQueue,
  parseComposeRecipients,
} from '@/utils/composeDraft';

describe('compose helpers', () => {
  it('keeps valid recipients and reports every invalid entry', () => {
    expect(
      parseComposeRecipients(
        'alice@example.com, not-an-email, bob@example.org',
      ),
    ).toEqual({
      addresses: [
        { address: 'alice@example.com' },
        { address: 'bob@example.org' },
      ],
      invalid: ['not-an-email'],
    });
  });

  it('builds a native draft payload without creating empty recipient arrays', () => {
    expect(
      buildComposeDraftPayload(
        {
          to: 'alice@example.com',
          cc: '',
          bcc: 'bob@example.org',
          subject: 'Hello',
          body: 'Message body',
          replyTo: 'message-1',
        },
        'draft-1',
        false,
      ),
    ).toEqual({
      to: [{ address: 'alice@example.com' }],
      cc: undefined,
      bcc: [{ address: 'bob@example.org' }],
      subject: 'Hello',
      text: 'Message body',
      html: undefined,
      inReplyTo: 'message-1',
      existingDraftId: 'draft-1',
    });
  });
  it('keeps HTML and derives plain text for web drafts without importing the editor', () => {
    const payload = buildComposeDraftPayload(
      {
        to: '',
        cc: '',
        bcc: '',
        subject: 'Hello',
        body: '<p>Hello <strong>there</strong></p>',
      },
      undefined,
      true,
    );
    expect(payload.html).toBe('<p>Hello <strong>there</strong></p>');
    expect(payload.text).toBe('Hello there');
  });
});

describe('draft save queue', () => {
  it('serializes saves so a later save can reuse the first draft id', async () => {
    const queue = createDraftSaveQueue();
    let resolveFirst: ((value: boolean) => void) | undefined;
    const firstSave = jest.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    const secondSave = jest.fn(async () => true);

    const firstResult = queue.enqueue(firstSave);
    const secondResult = queue.enqueue(secondSave);
    await Promise.resolve();

    expect(firstSave).toHaveBeenCalledTimes(1);
    expect(secondSave).not.toHaveBeenCalled();

    resolveFirst?.(true);
    await expect(firstResult).resolves.toBe(true);
    await expect(secondResult).resolves.toBe(true);
    expect(secondSave).toHaveBeenCalledTimes(1);
  });
});
