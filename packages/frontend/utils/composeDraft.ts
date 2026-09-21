import type { ComposeRecoverySnapshot } from './composeRecovery';
import {
  isValidRecipientEmail,
  parseRecipientList,
} from '@/schemas/emailSchemas';
import { stripHtml } from './stripHtml';
export type ComposeDraftSaveState = 'idle' | 'saving' | 'saved' | 'error';

export type ComposeDraftSnapshot = ComposeRecoverySnapshot;

export interface ParsedComposeRecipients {
  addresses: { address: string }[];
  invalid: string[];
}

export interface DraftSaveQueue {
  enqueue: (save: () => Promise<boolean>) => Promise<boolean>;
}

export function createDraftSaveQueue(): DraftSaveQueue {
  let queue: Promise<boolean> = Promise.resolve(false);

  return {
    enqueue(save) {
      const queuedSave = queue.then(save, save);
      queue = queuedSave.then(
        () => false,
        () => false,
      );
      return queuedSave;
    },
  };
}

export function parseComposeRecipients(input: string): ParsedComposeRecipients {
  const entries = input
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const invalid = entries.filter((entry) => !isValidRecipientEmail(entry));

  return {
    addresses: parseRecipientList(input),
    invalid,
  };
}

export function buildComposeDraftPayload(
  snapshot: ComposeDraftSnapshot,
  existingDraftId?: string,
  web = false,
) {
  return {
    to: snapshot.to.trim()
      ? parseComposeRecipients(snapshot.to).addresses
      : undefined,
    cc: snapshot.cc.trim()
      ? parseComposeRecipients(snapshot.cc).addresses
      : undefined,
    bcc: snapshot.bcc.trim()
      ? parseComposeRecipients(snapshot.bcc).addresses
      : undefined,
    subject: snapshot.subject || undefined,
    text: web
      ? stripHtml(snapshot.body) || undefined
      : snapshot.body || undefined,
    html: web ? snapshot.body || undefined : undefined,
    inReplyTo: snapshot.replyTo,
    ...(snapshot.attachments && snapshot.attachments.length > 0
      ? { attachments: snapshot.attachments.map(({ fileId }) => ({ fileId })) }
      : {}),
    existingDraftId,
  };
}
