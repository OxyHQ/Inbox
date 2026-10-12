/**
 * One compose session: the fields, the server draft behind them, and the ways
 * the session ends — sent, scheduled, saved, or discarded.
 *
 * Shared by the full composer and the inline reply, so the two cannot drift.
 * They had: the inline reply never saved a draft at all, and silently dropped
 * any address it could not parse instead of refusing to send.
 *
 * The server draft is the session's identity. Every save names it
 * (`existingDraftId` + `expectedRevision`), and the send names it too
 * (`draftId`), so the API removes the draft once the message has left. Before
 * that, a sent message stayed in Drafts and a draft could not be sent at all.
 */

import { toast } from '@oxy.so/bloom';
import type { FileMetadata } from '@oxy.so/core';
import { useOxy } from '@oxy.so/services';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import {
  useDiscardDraft,
  useSaveDraft,
  useSendMessage,
  useSendMessageWithUndo,
  type PendingSend,
} from '@/hooks/mutations/useMessageMutations';
import { useEmailStore } from '@/hooks/useEmail';
import type { Message } from '@/services/emailApi';
import {
  appendTextToBody,
  bodyParts,
  draftToEditorContent,
  editorContentToText,
  isBodyBlank,
  signatureBlock,
  textToEditorContent,
} from '@/utils/composeBody';
import {
  buildComposeDraftPayload,
  createDraftSaveQueue,
  parseComposeRecipients,
  type ComposeDraftSaveState,
  type ComposeDraftSnapshot,
} from '@/utils/composeDraft';
import {
  clearComposeRecovery,
  composeRecoveryStorageKey,
  loadComposeRecovery,
  saveComposeRecovery,
} from '@/utils/composeRecovery';
import type { ReplyHeaders } from '@/utils/replyHeaders';
import { joinAddresses } from '@/utils/replyRecipients';
import { type TranslateFn, useTranslation } from '@/lib/i18n';
import {
  type AlreadySent,
  alreadySentUnderKey,
  newSendIdempotencyKey,
} from '@/utils/sendIdempotency';

const isWeb = Platform.OS === 'web';
const AUTOSAVE_DELAY_MS = 8_000;
const RECOVERY_DELAY_MS = 750;

/**
 * An attachment as the composer holds it: a reference into the user's Oxy File
 * Manager, plus what the chip shows.
 */
export interface ComposerAttachment {
  fileId: string;
  name: string;
  contentType: string;
  size: number;
}

function fileMetadataToAttachment(file: FileMetadata): ComposerAttachment {
  return {
    fileId: file.id,
    name: file.filename || file.id,
    contentType: file.contentType || 'application/octet-stream',
    size: file.length,
  };
}

/** What decides whether there is something unsaved: only what the user can see. */
function contentKeyOf(fields: {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  attachments: readonly ComposerAttachment[];
}): string {
  return JSON.stringify([
    fields.to,
    fields.cc,
    fields.bcc,
    fields.subject,
    fields.body,
    fields.attachments.map(({ fileId, name, contentType, size }) => ({
      fileId,
      name,
      contentType,
      size,
    })),
  ]);
}

/** How the composer repeats a send once the user says to send it as a new message. */
export type SentVersionRetry = { kind: 'send' } | { kind: 'schedule'; at: Date };

/** A send refused because its key already sent another version of the message. */
export interface SentVersion {
  sent: AlreadySent;
  retry: SentVersionRetry;
  /** What happened to the version already sent, in the user's words. */
  notice: string;
}

/** A scheduled time as the composer shows it. */
function scheduledTimeLabel(date: Date): string {
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * What to tell the user about the message their key already sent: `closed`
 * when the composer closes because this compose IS that message, `open` when
 * it stays open to ask about sending this one as new. Worded from where that
 * message is — a failed or cancelled one never closes the composer.
 */
export function alreadySentNotice(
  t: TranslateFn,
  sent: AlreadySent,
  outcome: 'closed' | 'open',
): string {
  const due =
    sent.deliveryState === 'scheduled' && sent.scheduledAt ? new Date(sent.scheduledAt) : null;
  const time = due && !Number.isNaN(due.getTime()) ? scheduledTimeLabel(due) : null;
  if (sent.deliveryState === 'failed') return t('compose.alreadySent.versionFailed');
  if (sent.deliveryState === 'cancelled') return t('compose.alreadySent.versionCancelled');
  if (outcome === 'closed') {
    return time
      ? t('compose.alreadySent.closedScheduled', { time })
      : t('compose.alreadySent.closedSent');
  }
  return time
    ? t('compose.alreadySent.versionScheduled', { time })
    : t('compose.alreadySent.versionSent');
}

/** Every address field parses: a save of it keeps exactly what was typed. */
function recipientsAllParse(...fields: string[]): boolean {
  return fields.every((value) => parseComposeRecipients(value).invalid.length === 0);
}

/**
 * A save the API refused with 409: `'gone'` when the draft no longer exists —
 * sent or deleted, the API answers `currentRevision: null` — `'changed'` when
 * another device saved it at a newer revision. `null` for any other error.
 */
export function draftConflictKind(error: unknown): 'gone' | 'changed' | null {
  if (!error || typeof error !== 'object') return null;
  const candidate = error as {
    status?: number;
    statusCode?: number;
    response?: { status?: number; data?: { details?: unknown } };
    details?: unknown;
  };
  // Any of the three: an error path may carry the status in only one of them.
  const statuses = [candidate.status, candidate.statusCode, candidate.response?.status];
  if (!statuses.includes(409)) return null;
  const details = candidate.details ?? candidate.response?.data?.details;
  const gone =
    typeof details === 'object' &&
    details !== null &&
    'currentRevision' in details &&
    details.currentRevision === null;
  return gone ? 'gone' : 'changed';
}

export interface ComposeSessionOptions {
  /**
   * Names the local crash-recovery snapshot: `new`, `reply:<id>`,
   * `forward:<id>` or `draft:<id>`.
   */
  recoveryIdentity: string;
  /** The server draft this session continues. Its id is the session's draft. */
  draft?: Message;
  /** Starting fields when there is no draft (a reply's recipients, a mailto link). */
  initial?: { to?: string; cc?: string; subject?: string; body?: string };
  /** Row id of the message replied to; kept with the recovery snapshot. */
  replyTo?: string;
  /** The RFC threading headers every save and send carries. */
  replyHeaders?: ReplyHeaders;
  /**
   * The headers are still being resolved. Nothing that would carry them —
   * a server save or a send — runs until they are known.
   */
  awaitingReplyHeaders: boolean;
  /**
   * Content that follows the editable body in what is saved and sent: the quote
   * under a reply, the forwarded message. Shown read-only by the caller.
   */
  trailer?: string;
  /** Start an empty body with the user's signature. */
  insertSignature: boolean;
  /** The session is over (sent, saved, discarded); the caller closes. */
  onFinished: () => void;
  /**
   * Where this compose opens again from its local snapshot (the same recovery
   * identity). Offered as Open draft when a send is refused after the composer
   * has gone and the snapshot is all that holds the text.
   */
  reopen?: Href;
}

export function useComposeSession({
  recoveryIdentity,
  draft,
  initial,
  replyTo,
  replyHeaders,
  awaitingReplyHeaders,
  trailer = '',
  insertSignature,
  onFinished,
  reopen,
}: ComposeSessionOptions) {
  const { t } = useTranslation();
  const { user } = useOxy();
  const router = useRouter();
  const api = useEmailStore((s) => s._api);
  const { sendWithUndo, isPending: sendPending } = useSendMessageWithUndo();
  const sendMessageMutation = useSendMessage();
  const saveDraftMutation = useSaveDraft();
  const discardDraftMutation = useDiscardDraft();
  const saveDraftAsync = saveDraftMutation.mutateAsync;
  const discardDraftAsync = discardDraftMutation.mutateAsync;

  // Everything below is seeded ONCE, from the draft or the initial fields. The
  // caller mounts the session only after what it is seeded from has loaded.
  const [seed] = useState(() => {
    if (draft) {
      return {
        to: joinAddresses(draft.to),
        cc: joinAddresses(draft.cc),
        bcc: joinAddresses(draft.bcc),
        subject: draft.subject,
        body: draftToEditorContent(draft, isWeb),
        attachments: draft.attachments.map((attachment) => ({
          fileId: attachment.fileId,
          name: attachment.name,
          contentType: attachment.contentType,
          size: attachment.size,
        })),
      };
    }
    return {
      to: initial?.to ?? '',
      cc: initial?.cc ?? '',
      bcc: '',
      subject: initial?.subject ?? '',
      body: initial?.body ?? '',
      attachments: [] as ComposerAttachment[],
    };
  });

  // One key per compose session (see utils/sendIdempotency.ts); replaced by the
  // recovered one when this composer resumes an earlier session.
  const [idempotencyKey, setIdempotencyKey] = useState(newSendIdempotencyKey);
  const [to, setTo] = useState(seed.to);
  const [cc, setCc] = useState(seed.cc);
  const [bcc, setBcc] = useState(seed.bcc);
  const [subject, setSubject] = useState(seed.subject);
  const [body, setBody] = useState(seed.body);
  const [attachments, setAttachments] = useState<ComposerAttachment[]>(seed.attachments);
  const [recoveryLoaded, setRecoveryLoaded] = useState(false);
  const [draftSaveState, setDraftSaveState] = useState<ComposeDraftSaveState>('idle');
  const [draftSaveQueue] = useState(createDraftSaveQueue);

  const bodyValueRef = useRef(seed.body);
  const updateBody = useCallback((next: string) => {
    bodyValueRef.current = next;
    setBody(next);
  }, []);

  // The exact signature this composer wrote, so a body holding only it is not
  // "content" — it used to be, and every composer opened by a user with a
  // signature autosaved a junk draft and asked "Save draft?" on close. State,
  // not a ref: `hasContent` and `ownText` are derived from it during render.
  const [signature, setSignature] = useState<string | null>(null);

  const draftIdRef = useRef<string | null>(draft?._id ?? null);
  const draftRevisionRef = useRef<number | null>(draft?.draftRevision ?? null);
  /** This session created the server draft, so discarding the session deletes it. */
  const createdDraftRef = useRef(false);
  /** A send is under way or done: no server save may land after it. */
  const sentRef = useRef(false);
  /** The send waiting out its undo window; discarding the session calls it off. */
  const pendingSendRef = useRef<PendingSend | null>(null);
  /** Discarded: nothing may write the draft again. */
  const discardedRef = useRef(false);
  const mountedRef = useRef(true);

  // A send finishes after its undo window, and the user may have left the
  // composer by then; closing it a second time would navigate away from
  // wherever they are now.
  const finish = useCallback(() => {
    if (mountedRef.current) onFinished();
  }, [onFinished]);

  const recoveryKey = useMemo(
    () => composeRecoveryStorageKey(user?.id, recoveryIdentity),
    [recoveryIdentity, user?.id],
  );

  const snapshot = useMemo<ComposeDraftSnapshot>(
    () => ({
      to,
      cc,
      bcc,
      subject,
      body,
      attachments: attachments.map(({ fileId, name, contentType, size }) => ({
        fileId,
        name,
        contentType,
        size,
      })),
      ...(replyTo ? { replyTo } : {}),
      idempotencyKey,
    }),
    [to, cc, bcc, subject, body, attachments, replyTo, idempotencyKey],
  );
  // The idempotency key is not content.
  const contentKey = contentKeyOf({ to, cc, bcc, subject, body, attachments });
  // The session starts with nothing unsaved: a reopened draft is saved as it
  // is, and the fields a reply or a link starts with are not the user's
  // writing. Treating them as unsaved autosaved a junk draft for every reply
  // left open, and closing an untouched reply saved one.
  const [seedContentKey] = useState(() => contentKeyOf(seed));
  const [savedContentKey, setSavedContentKey] = useState<string>(seedContentKey);

  // Something written in this session: a field that differs, as text, from how
  // the composer started. What it fills in by itself — a reply's recipients and
  // "Re:" subject, a link's fields, the signature, a reopened draft — is not
  // writing, and neither is the editor re-serialising its markup on mount: each
  // of those used to create a draft nobody wrote.
  const hasContent =
    addressListKey(to) !== addressListKey(seed.to) ||
    addressListKey(cc) !== addressListKey(seed.cc) ||
    addressListKey(bcc) !== addressListKey(seed.bcc) ||
    subject.trim() !== seed.subject.trim() ||
    attachmentsKey(attachments) !== attachmentsKey(seed.attachments) ||
    writtenText(body, signature) !== writtenText(seed.body, null);
  const isDirty = contentKey !== savedContentKey;
  // What closing keeps: unsaved edits of the user's — or a reopened draft put
  // back as it was opened after an autosave had already changed it on the server.
  const hasUnsavedWork = isDirty && (hasContent || Boolean(draft));
  const sending = sendPending || sendMessageMutation.isPending;
  const sendDisabled = sending || awaitingReplyHeaders;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── A send that may have reached the server ──────────────────────
  /**
   * The content of the last send that went to the server without an answer —
   * it failed, or timed out, and the server may hold it all the same. Sending
   * that content again reuses the key, so the API sees the same message. Once
   * the content differs it is a different message and needs a new key: under
   * the old one the API refuses it as a reused key (422, see
   * `alreadySentUnderKey` and `handleKeyReused`).
   */
  const attemptedContentKeyRef = useRef<string | null>(null);
  /**
   * The content a snapshot was restored with, under the key it was composed
   * with — a key that may have sent it before the crash. That key is kept
   * through every edit: a new one would send the edits as a second message
   * without asking. Sent under the old key, edits are refused (422) and
   * `handleKeyReused` asks. Cleared once the user chooses a new key.
   */
  const restoredKeyContentRef = useRef<string | null>(null);
  useEffect(() => {
    const attempted = attemptedContentKeyRef.current;
    if (attempted === null || attempted === contentKey) return;
    if (restoredKeyContentRef.current !== null) return;
    attemptedContentKeyRef.current = null;
    setIdempotencyKey(newSendIdempotencyKey());
  }, [contentKey]);

  // ── Local crash recovery ──────────────────────────────────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: Seeded once per session, like the fields themselves.
  useEffect(() => {
    let cancelled = false;
    void loadComposeRecovery(recoveryKey).then((record) => {
      if (cancelled) return;
      // A reopened draft yields to a snapshot only when that snapshot holds
      // edits made after the draft was last saved: a successful save deletes
      // the snapshot, so one that is still there and newer was never saved.
      const usable = record && (!draft || record.savedAt > Date.parse(draft.date));
      if (record && usable) {
        const restored = {
          to: record.snapshot.to,
          cc: record.snapshot.cc,
          bcc: record.snapshot.bcc,
          subject: record.snapshot.subject,
          body: record.snapshot.body,
          attachments: (record.snapshot.attachments ?? []).map((attachment) => ({
            fileId: attachment.fileId,
            name: attachment.name ?? attachment.fileId,
            contentType: attachment.contentType ?? 'application/octet-stream',
            size: attachment.size ?? 0,
          })),
        };
        if (record.snapshot.idempotencyKey) {
          setIdempotencyKey(record.snapshot.idempotencyKey);
          restoredKeyContentRef.current = contentKeyOf(restored);
        }
        setTo(restored.to);
        setCc(restored.cc);
        setBcc(restored.bcc);
        setSubject(restored.subject);
        updateBody(restored.body);
        setAttachments(restored.attachments);
      }
      setRecoveryLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [recoveryKey]);

  // ── Signature ─────────────────────────────────────────────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: Once per session: the signature is inserted into an empty body, never again.
  useEffect(() => {
    if (!api || !insertSignature) return;
    let cancelled = false;
    void api
      .getSettings()
      .then((settings) => {
        if (cancelled || !settings.signature) return;
        if (!isBodyBlank(bodyValueRef.current, null, isWeb)) return;
        const block = signatureBlock(settings.signature, isWeb);
        setSignature(block);
        updateBody(block);
        // The signature is where the session starts, not something to save.
        setSavedContentKey((saved) =>
          saved === seedContentKey ? contentKeyOf({ ...seed, body: block }) : saved,
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : t('compose.toast.signatureFailed'));
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  // ── Server draft ──────────────────────────────────────────────────
  // The last COMMITTED render's values, for the unmount save and a queued send.
  // Written after each commit (below `deleteServerDraft`), never during render:
  // a render React throws away must not leave its values here.
  const latest = useRef({ snapshot, contentKey, hasContent, hasUnsavedWork });

  const saveToServer = useCallback(
    (current: ComposeDraftSnapshot, key: string): Promise<boolean> => {
      const save = async (): Promise<boolean> => {
        // A server draft of a reply without its threading headers would be sent
        // unthreaded later. The local recovery snapshot still keeps the text.
        if (!api || sentRef.current || discardedRef.current || awaitingReplyHeaders) return false;
        if (mountedRef.current) setDraftSaveState('saving');
        try {
          const saved = await saveDraftAsync({
            ...buildComposeDraftPayload(
              { ...current, body: current.body + trailer },
              draftIdRef.current ?? undefined,
              isWeb,
              replyHeaders,
            ),
            ...(draftIdRef.current && draftRevisionRef.current
              ? { expectedRevision: draftRevisionRef.current }
              : {}),
          });
          if (!draftIdRef.current) createdDraftRef.current = true;
          draftIdRef.current = saved._id;
          draftRevisionRef.current = saved.draftRevision;
          // An address that does not parse yet (`bob@example`) is left out of
          // the server draft. The edits stay unsaved, and the local snapshot
          // keeps them, so closing still asks and reopening still has them.
          const complete = recipientsAllParse(current.to, current.cc, current.bcc);
          if (mountedRef.current) {
            if (complete) setSavedContentKey(key);
            setDraftSaveState('saved');
          }
          if (complete) void clearComposeRecovery(recoveryKey);
          return true;
        } catch (error) {
          const conflict = draftConflictKind(error);
          if (conflict) {
            // Another device changed this draft, or sent or deleted it. Never
            // overwrite that: the next save starts a new draft from the edits
            // still open here, so nothing typed is lost either.
            draftIdRef.current = null;
            draftRevisionRef.current = null;
            if (mountedRef.current) {
              toast.error(
                t(
                  conflict === 'gone'
                    ? 'compose.toast.draftGoneConflict'
                    : 'compose.toast.draftConflict',
                ),
              );
            }
          }
          if (mountedRef.current) setDraftSaveState('error');
          return false;
        }
      };
      return draftSaveQueue.enqueue(save);
    },
    [
      api,
      awaitingReplyHeaders,
      draftSaveQueue,
      recoveryKey,
      replyHeaders,
      saveDraftAsync,
      t,
      trailer,
    ],
  );

  useEffect(() => {
    if (!api || !recoveryLoaded || !hasUnsavedWork || sending || sentRef.current) return;
    const timer = setTimeout(() => {
      void saveToServer(snapshot, contentKey);
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [api, recoveryLoaded, hasUnsavedWork, sending, snapshot, contentKey, saveToServer]);

  useEffect(() => {
    if (!recoveryLoaded || !hasUnsavedWork || sending || sentRef.current) return;
    const timer = setTimeout(() => {
      void saveComposeRecovery(recoveryKey, snapshot);
    }, RECOVERY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [snapshot, hasUnsavedWork, recoveryKey, recoveryLoaded, sending]);

  // Leaving without Send, Save or Discard — a back gesture, a route change, a
  // thread closed under an inline reply — keeps what was written as a draft.
  // Everything written and then erased again leaves no draft behind either.
  const saveToServerRef = useRef(saveToServer);
  const deleteServerDraftRef = useRef<() => Promise<void>>(async () => undefined);
  useEffect(
    () => () => {
      if (sentRef.current || discardedRef.current) return;
      const {
        snapshot: last,
        contentKey: key,
        hasContent: had,
        hasUnsavedWork: unsaved,
      } = latest.current;
      if (unsaved) void saveToServerRef.current(last, key);
      else if (!had && createdDraftRef.current) void deleteServerDraftRef.current();
    },
    [],
  );

  const visibleSaveState = draftSaveState === 'saved' && isDirty ? 'idle' : draftSaveState;
  const draftStatusLabel =
    visibleSaveState === 'saving'
      ? t('common.saving')
      : visibleSaveState === 'saved'
        ? t('common.saved')
        : visibleSaveState === 'error'
          ? t('common.notSaved')
          : null;

  /**
   * Put plain text (a template) into the body: in place of a body that holds
   * nothing written yet — above the signature, where one is — or on a new line
   * after what is there.
   */
  const insertText = useCallback(
    (text: string) => {
      const current = bodyValueRef.current;
      if (isBodyBlank(current, signature, isWeb)) {
        const lead = textToEditorContent(text, isWeb);
        updateBody(signature && !isBodyBlank(current, null, isWeb) ? `${lead}${current}` : lead);
        return;
      }
      updateBody(appendTextToBody(current, text, isWeb));
    },
    [signature, updateBody],
  );

  /**
   * The body split into what the user wrote and the signature this composer
   * put under it — while that signature is still intact at the end. Once the
   * user has edited into it, it is their text like the rest.
   */
  const splitSignature = useCallback(
    (content: string) => {
      if (signature && content.endsWith(signature)) {
        return { own: content.slice(0, -signature.length), signature };
      }
      return { own: content, signature: '' };
    },
    [signature],
  );

  /** Replace what the user wrote with plain text (an AI rewrite), keeping the signature. */
  const replaceOwnText = useCallback(
    (text: string) => {
      const kept = splitSignature(bodyValueRef.current).signature;
      updateBody(`${textToEditorContent(text, isWeb)}${kept}`);
    },
    [splitSignature, updateBody],
  );

  const ownText = useMemo(
    () => editorContentToText(splitSignature(body).own, isWeb).trim(),
    [body, splitSignature],
  );

  // ── Recipients and attachments ────────────────────────────────────

  // Every field is checked, and one bad address refuses the send: dropping it
  // quietly sends the message to fewer people than the user addressed.
  const validatedRecipients = useCallback(() => {
    if (!to.trim()) {
      toast.error(t('compose.toast.addRecipient'));
      return null;
    }
    const parsed = [to, cc, bcc].map((value) => parseComposeRecipients(value));
    const invalid = parsed.flatMap((field) => field.invalid);
    if (invalid.length > 0) {
      toast.error(`${t('compose.toast.invalidEmail')} (${invalid.join(', ')})`);
      return null;
    }
    if (parsed[0].addresses.length === 0) {
      toast.error(t('compose.toast.invalidEmail'));
      return null;
    }
    return {
      to: parsed[0].addresses,
      cc: parsed[1].addresses.length > 0 ? parsed[1].addresses : undefined,
      bcc: parsed[2].addresses.length > 0 ? parsed[2].addresses : undefined,
    };
  }, [to, cc, bcc, t]);

  // De-duplicated by fileId, so picking the same file twice is one chip.
  const addFiles = useCallback((files: FileMetadata[]) => {
    if (files.length === 0) return;
    setAttachments((prev) => {
      const seen = new Set(prev.map((a) => a.fileId));
      const next = [...prev];
      for (const file of files) {
        if (seen.has(file.id)) continue;
        seen.add(file.id);
        next.push(fileMetadataToAttachment(file));
      }
      return next;
    });
  }, []);

  const removeAttachment = useCallback((fileId: string) => {
    setAttachments((prev) => prev.filter((a) => a.fileId !== fileId));
  }, []);

  // ── Ending the session ────────────────────────────────────────────

  /** Wait for a save already in flight, so the send names the draft it made. */
  const settleSaves = useCallback(
    () => draftSaveQueue.enqueue(() => Promise.resolve(false)),
    [draftSaveQueue],
  );

  const messagePayload = useCallback(
    (recipients: NonNullable<ReturnType<typeof validatedRecipients>>, key: string) => ({
      ...recipients,
      subject,
      ...bodyParts(body + trailer, isWeb),
      ...(replyHeaders ?? {}),
      attachments:
        attachments.length > 0 ? attachments.map((a) => ({ fileId: a.fileId })) : undefined,
      ...(draftIdRef.current ? { draftId: draftIdRef.current } : {}),
      idempotencyKey: key,
    }),
    [attachments, body, replyHeaders, subject, trailer],
  );

  // ── A key that already sent a different message ───────────────────
  /** A refused key the user has to answer: send this compose as a new message, or not. */
  const [sentVersion, setSentVersion] = useState<SentVersion | null>(null);

  const viewSent = useCallback(
    (sent: AlreadySent) => {
      if (sent.id) router.push(`/conversation/${sent.id}`);
    },
    [router],
  );

  /**
   * The API refused this session's key: it already sent a different message
   * under it (`alreadySentUnderKey`). `attempt` is what was sent now and the
   * content the key was first used with — a restored snapshot, or a send that
   * got no answer.
   *
   * Unchanged since then, and not failed or cancelled: this compose WAS sent,
   * typically before a crash it was restored from. End the session as a send
   * that went through — say so, link to it, drop the leftover server draft and
   * the local snapshot, and close without asking to save.
   *
   * Otherwise the user has written something the sent version does not hold,
   * or that version never left: keep the composer, its edits and its snapshot,
   * and ask whether to send this as a new message. Only a yes mints a new key:
   * resending under one on its own could deliver the same message twice. When
   * the composer has gone already — closed in the undo window, navigated away
   * from — the answer is a toast instead: what happened, View, and Open draft
   * when the text is left only in the local snapshot.
   */
  const handleKeyReused = useCallback(
    (
      sent: AlreadySent,
      retry: SentVersionRetry,
      attempt: { attempted: string | null; sent: string },
    ) => {
      pendingSendRef.current = null;
      const unchanged =
        attempt.attempted !== null &&
        attempt.attempted === attempt.sent &&
        latest.current.contentKey === attempt.sent;
      const left = sent.deliveryState !== 'failed' && sent.deliveryState !== 'cancelled';
      if (unchanged && left) {
        toast.info(
          alreadySentNotice(t, sent, 'closed'),
          sent.id
            ? {
                action: { label: t('compose.alreadySent.view'), onClick: () => viewSent(sent) },
              }
            : undefined,
        );
        // `sentRef` stays set, so nothing saves the session again.
        finish();
        void deleteServerDraftRef.current();
        return;
      }
      sentRef.current = false;
      const notice = alreadySentNotice(t, sent, 'open');
      if (mountedRef.current) {
        setSentVersion({ sent, retry, notice });
        return;
      }
      // No server draft holds the text: the local snapshot does, and Open
      // draft resumes the composer from it, under the same key, to ask again.
      const snapshotOnly = Boolean(reopen) && !draftIdRef.current;
      if (snapshotOnly) void saveComposeRecovery(recoveryKey, latest.current.snapshot);
      const buttons = [
        ...(snapshotOnly && reopen
          ? [{ label: t('compose.alreadySent.openDraft'), onClick: () => router.push(reopen) }]
          : []),
        ...(sent.id
          ? [{ label: t('compose.alreadySent.view'), onClick: () => viewSent(sent) }]
          : []),
      ];
      toast.warning(notice, {
        ...(buttons[0] ? { action: buttons[0] } : {}),
        ...(buttons[1] ? { cancel: buttons[1] } : {}),
      });
    },
    [finish, recoveryKey, reopen, router, t, viewSent],
  );

  const startSend = useCallback(
    async (key: string) => {
      if (awaitingReplyHeaders || sentRef.current) return;
      const recipients = validatedRecipients();
      if (!recipients) return;

      sentRef.current = true;
      await settleSaves();
      if (discardedRef.current) return;
      const attempt = {
        attempted: restoredKeyContentRef.current ?? attemptedContentKeyRef.current,
        sent: latest.current.contentKey,
      };
      pendingSendRef.current = sendWithUndo(messagePayload(recipients, key), {
        // Accepted: filed in Sent, its delivery shown on it from now on. The
        // server holds the message, so the local snapshot has done its job.
        onSuccess: () => {
          void clearComposeRecovery(recoveryKey);
          finish();
        },
        onError: () => {
          pendingSendRef.current = null;
          sentRef.current = false;
          attemptedContentKeyRef.current = latest.current.contentKey;
        },
        onAlreadySent: (sent) => handleKeyReused(sent, { kind: 'send' }, attempt),
        onCancel: () => {
          pendingSendRef.current = null;
          sentRef.current = false;
        },
      });
    },
    [
      awaitingReplyHeaders,
      messagePayload,
      finish,
      handleKeyReused,
      recoveryKey,
      sendWithUndo,
      settleSaves,
      validatedRecipients,
    ],
  );

  const send = useCallback(() => startSend(idempotencyKey), [idempotencyKey, startSend]);

  const startSchedule = useCallback(
    async (scheduledDate: Date, key: string) => {
      if (awaitingReplyHeaders || sentRef.current) return;
      const recipients = validatedRecipients();
      if (!recipients) return;

      sentRef.current = true;
      await settleSaves();
      const attempt = {
        attempted: restoredKeyContentRef.current ?? attemptedContentKeyRef.current,
        sent: latest.current.contentKey,
      };
      sendMessageMutation.mutate(
        { ...messagePayload(recipients, key), scheduledAt: scheduledDate.toISOString() },
        {
          onSuccess: () => {
            toast.success(
              t('compose.toast.scheduled', { time: scheduledTimeLabel(scheduledDate) }),
            );
            void clearComposeRecovery(recoveryKey);
            finish();
          },
          onError: (err: Error) => {
            const alreadySent = alreadySentUnderKey(err);
            if (alreadySent) {
              handleKeyReused(alreadySent, { kind: 'schedule', at: scheduledDate }, attempt);
              return;
            }
            sentRef.current = false;
            attemptedContentKeyRef.current = latest.current.contentKey;
            toast.error(err.message || t('compose.toast.scheduleFailed'));
          },
        },
      );
    },
    [
      awaitingReplyHeaders,
      messagePayload,
      finish,
      handleKeyReused,
      recoveryKey,
      sendMessageMutation,
      settleSaves,
      t,
      validatedRecipients,
    ],
  );

  const schedule = useCallback(
    (scheduledDate: Date) => startSchedule(scheduledDate, idempotencyKey),
    [idempotencyKey, startSchedule],
  );

  /** The user said yes: this compose is a new message, under a new key. */
  const sendAsNew = useCallback(
    (version: SentVersion) => {
      setSentVersion(null);
      const key = newSendIdempotencyKey();
      attemptedContentKeyRef.current = null;
      restoredKeyContentRef.current = null;
      setIdempotencyKey(key);
      if (version.retry.kind === 'schedule') void startSchedule(version.retry.at, key);
      else void startSend(key);
    },
    [startSchedule, startSend],
  );

  const dismissSentVersion = useCallback(() => setSentVersion(null), []);

  const deleteServerDraft = useCallback(async () => {
    discardedRef.current = true;
    // Discarded inside the undo window: the message the user threw away must
    // not go out after the composer has closed.
    pendingSendRef.current?.cancel();
    pendingSendRef.current = null;
    void clearComposeRecovery(recoveryKey);
    await settleSaves();
    const draftId = draftIdRef.current;
    if (!draftId) return;
    try {
      await discardDraftAsync(draftId);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('common.notSaved'));
    }
  }, [discardDraftAsync, recoveryKey, settleSaves, t]);

  // Every commit: what the unmount save above and a queued send read.
  useEffect(() => {
    latest.current = { snapshot, contentKey, hasContent, hasUnsavedWork };
    saveToServerRef.current = saveToServer;
    deleteServerDraftRef.current = deleteServerDraft;
  });

  /** Save now and close. Nothing to save closes at once. */
  const saveAndClose = useCallback(async () => {
    // Sent, or waiting out its undo window: the message is on its way and there
    // is no draft to keep. Closing leaves the send to finish.
    if (sentRef.current) {
      finish();
      return;
    }
    if (!hasUnsavedWork) {
      if (!hasContent && createdDraftRef.current) {
        // Written, autosaved, then erased: the draft it left is empty now.
        finish();
        await deleteServerDraft();
        return;
      }
      void clearComposeRecovery(recoveryKey);
      finish();
      return;
    }
    const saved = await saveToServer(snapshot, contentKey);
    if (saved) {
      toast(t('compose.toast.draftSaved'));
      finish();
    } else if (mountedRef.current) {
      toast.error(t('common.notSaved'));
    }
  }, [
    contentKey,
    deleteServerDraft,
    hasContent,
    hasUnsavedWork,
    finish,
    recoveryKey,
    saveToServer,
    snapshot,
    t,
  ]);

  /**
   * Close without keeping the unsaved edits. A draft this session created is
   * deleted with them; a draft the user reopened keeps its last saved version.
   */
  const discardChanges = useCallback(async () => {
    discardedRef.current = true;
    pendingSendRef.current?.cancel();
    pendingSendRef.current = null;
    if (createdDraftRef.current) {
      finish();
      await deleteServerDraft();
      return;
    }
    void clearComposeRecovery(recoveryKey);
    finish();
  }, [deleteServerDraft, finish, recoveryKey]);

  /** Throw the whole draft away, wherever it came from. */
  const discardDraft = useCallback(async () => {
    discardedRef.current = true;
    finish();
    await deleteServerDraft();
  }, [deleteServerDraft, finish]);

  return {
    to,
    setTo,
    cc,
    setCc,
    bcc,
    setBcc,
    subject,
    setSubject,
    body,
    updateBody,
    insertText,
    ownText,
    replaceOwnText,
    attachments,
    addFiles,
    removeAttachment,
    hasContent,
    isDirty,
    hasUnsavedWork,
    draftStatusLabel,
    draftSaveError: visibleSaveState === 'error',
    sending,
    sendDisabled,
    send,
    schedule,
    sentVersion,
    sendAsNew,
    viewSent,
    dismissSentVersion,
    saveAndClose,
    discardChanges,
    discardDraft,
  };
}

/** An address field as the addresses in it, so its own formatting is not an edit. */
function addressListKey(value: string): string {
  return value
    .split(/[,;\n]/)
    .map((address) => address.trim().toLowerCase())
    .filter(Boolean)
    .join(',');
}

function attachmentsKey(attachments: readonly ComposerAttachment[]): string {
  return attachments.map((attachment) => attachment.fileId).join(',');
}

/** The body as text, without the signature this composer inserted at its end. */
function writtenText(body: string, signature: string | null): string {
  const text = editorContentToText(body, isWeb).trim();
  if (!signature) return text;
  const signatureText = editorContentToText(signature, isWeb).trim();
  return signatureText && text.endsWith(signatureText)
    ? text.slice(0, -signatureText.length).trim()
    : text;
}
