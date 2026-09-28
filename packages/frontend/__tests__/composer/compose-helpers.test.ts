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

  const snapshot = {
    to: 'alice@example.com',
    cc: '',
    bcc: 'bob@example.org',
    subject: 'Hello',
    body: 'Message body',
    replyTo: 'message-1',
  };

  it('builds a native draft payload without creating empty recipient arrays', () => {
    expect(
      buildComposeDraftPayload(snapshot, 'draft-1', false, {
        inReplyTo: '<parent@example.com>',
        references: ['<root@example.com>', '<parent@example.com>'],
      }),
    ).toEqual({
      to: [{ address: 'alice@example.com' }],
      cc: undefined,
      bcc: [{ address: 'bob@example.org' }],
      subject: 'Hello',
      text: 'Message body',
      html: undefined,
      inReplyTo: '<parent@example.com>',
      references: ['<root@example.com>', '<parent@example.com>'],
      existingDraftId: 'draft-1',
    });
  });

  it('never sends the parent ROW id as In-Reply-To', () => {
    const payload = buildComposeDraftPayload(snapshot, undefined, false);
    expect(payload).not.toHaveProperty('inReplyTo');
    expect(JSON.stringify(payload)).not.toContain('message-1');
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
