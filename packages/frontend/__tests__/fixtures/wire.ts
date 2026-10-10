/**
 * Realistic `/email` response rows, in the exact JSON shape oxy-api sends
 * (`@oxy.so/contracts` email wire contract). Tests build on these instead of
 * hand-writing partial rows, so a fixture can never quietly be looser than the
 * server.
 */

const at = '2026-09-27T05:56:22.583Z';

export function wireMessage(overrides: Record<string, unknown> = {}) {
  const id = (overrides._id as string | undefined) ?? '01a0e16f-99bc-7f50-af45-9a9ca01a82ea';
  return {
    _id: id,
    id,
    userId: 'user-1',
    mailboxId: 'inbox-1',
    messageId: '<code@geopod-ismtpd-9>',
    threadId: id,
    from: { name: 'Ramp', address: 'communications@ramp.com' },
    to: [{ name: '', address: 'nate@oxy.so' }],
    cc: [],
    bcc: [],
    subject: '977687 is your Ramp sign-in code',
    attachments: [],
    flags: {
      seen: false,
      starred: false,
      answered: false,
      forwarded: false,
      draft: false,
      pinned: false,
    },
    labels: [],
    highlights: [],
    encrypted: false,
    spamScore: 0,
    spamAction: null,
    size: 40000,
    inReplyTo: null,
    references: [],
    aliasTag: null,
    snoozedUntil: null,
    snoozedFromMailbox: null,
    scheduledAt: null,
    readReceiptRequested: false,
    readReceiptSent: false,
    date: '2026-09-27T05:56:22.000Z',
    receivedAt: at,
    createdAt: at,
    updatedAt: at,
    draftRevision: 1,
    ...overrides,
  };
}

/** Ramp's AMP alternative, stored as an attachment with no Content-ID. */
export const ampAttachment = {
  fileId: 'file-1',
  name: 'attachment',
  contentType: 'text/x-amp-html',
  size: 22737,
  contentId: null,
  isInline: false,
};

export function wireContact(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'contact-1',
    id: 'contact-1',
    userId: 'user-1',
    name: 'Helen',
    email: 'helen@example.test',
    company: null,
    notes: null,
    starred: false,
    autoCollected: true,
    lastContactedAt: null,
    createdAt: at,
    updatedAt: at,
    ...overrides,
  };
}

export function wireOutbox(overrides: Record<string, unknown> = {}) {
  return {
    id: 'outbox-1',
    messageId: '<outbox-1@example.test>',
    status: 'failed',
    attempts: 2,
    maxAttempts: 8,
    terminal: false,
    nextAttemptAt: at,
    lastError: 'relay unavailable',
    sentAt: null,
    createdAt: at,
    updatedAt: at,
    ...overrides,
  };
}
