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
import { useTranslation } from '@/lib/i18n';
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
import { newSendIdempotencyKey } from '@/utils/sendIdempotency';

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
    fields.attachments.map(({ fileId, name, contentType, size }) => ({ fileId, name, contentType, size })),
  ]);
}

/** Every address field parses: a save of it keeps exactly what was typed. */
function recipientsAllParse(...fields: string[]): boolean {
  return fields.every((value) => parseComposeRecipients(value).invalid.length === 0);
}

function isDraftConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as {
    status?: number;
    statusCode?: number;
    response?: { status?: number };
  };
  return (
    candidate.status === 409 ||
    candidate.statusCode === 409 ||
    candidate.response?.status === 409
  );
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
}: ComposeSessionOptions) {
  const { t } = useTranslation();
  const { user } = useOxy();
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
  const [alreadyQueued, setAlreadyQueued] = useState(false);
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
  // signature autosaved a junk draft and asked "Save draft?" on close.
  const signatureRef = useRef<string | null>(null);

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
      ...(alreadyQueued ? { queued: true } : {}),
    }),
    [to, cc, bcc, subject, body, attachments, replyTo, idempotencyKey, alreadyQueued],
  );
  // The idempotency key and the queued mark are not content.
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
    writtenText(body, signatureRef.current) !== writtenText(seed.body, null);
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

  // ── Local crash recovery ──────────────────────────────────────────
  /**
   * The content of a recovered snapshot whose send was queued. Sending it again
   * reuses its idempotency key — the same message to the API. Once the content
   * differs it is a different message, and a new key: with the old one the API
   * answered with the queued message's outcome and the new one never left.
   */
  const queuedContentKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!alreadyQueued || queuedContentKeyRef.current === null) return;
    if (contentKey === queuedContentKeyRef.current) return;
    queuedContentKeyRef.current = null;
    setAlreadyQueued(false);
    setIdempotencyKey(newSendIdempotencyKey());
  }, [alreadyQueued, contentKey]);

  useEffect(() => {
    let cancelled = false;
    void loadComposeRecovery(recoveryKey).then((record) => {
      if (cancelled) return;
      // A reopened draft yields to a snapshot only when that snapshot holds
      // edits made after the draft was last saved: a successful save deletes
      // the snapshot, so one that is still there and newer was never saved.
      const usable =
        record &&
        (!draft || record.savedAt > Date.parse(draft.date));
      if (record && usable) {
        if (record.snapshot.idempotencyKey) setIdempotencyKey(record.snapshot.idempotencyKey);
        const queued = record.snapshot.queued === true;
        setAlreadyQueued(queued);
        queuedContentKeyRef.current = queued
          ? contentKeyOf({
              ...record.snapshot,
              attachments: (record.snapshot.attachments ?? []).map((attachment) => ({
                fileId: attachment.fileId,
                name: attachment.name ?? attachment.fileId,
                contentType: attachment.contentType ?? 'application/octet-stream',
                size: attachment.size ?? 0,
              })),
            })
          : null;
        setTo(record.snapshot.to);
        setCc(record.snapshot.cc);
        setBcc(record.snapshot.bcc);
        setSubject(record.snapshot.subject);
        updateBody(record.snapshot.body);
        setAttachments(
          (record.snapshot.attachments ?? []).map((attachment) => ({
            fileId: attachment.fileId,
            name: attachment.name ?? attachment.fileId,
            contentType: attachment.contentType ?? 'application/octet-stream',
            size: attachment.size ?? 0,
          })),
        );
      }
      setRecoveryLoaded(true);
    });
    return () => {
      cancelled = true;
    };
    // Seeded once per session, like the fields themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recoveryKey]);

  // ── Signature ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!api || !insertSignature) return;
    let cancelled = false;
    void api
      .getSettings()
      .then((settings) => {
        if (cancelled || !settings.signature) return;
        if (!isBodyBlank(bodyValueRef.current, null, isWeb)) return;
        const block = signatureBlock(settings.signature, isWeb);
        signatureRef.current = block;
        updateBody(block);
        // The signature is where the session starts, not something to save.
        setSavedContentKey((saved) =>
          saved === seedContentKey
            ? contentKeyOf({ ...seed, body: block })
            : saved,
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : t('compose.toast.signatureFailed'));
      });
    return () => {
      cancelled = true;
    };
    // Once per session: the signature is inserted into an empty body, never again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  // ── Server draft ──────────────────────────────────────────────────
  const latest = useRef({ snapshot, contentKey, hasContent, hasUnsavedWork });
  latest.current = { snapshot, contentKey, hasContent, hasUnsavedWork };

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
          if (isDraftConflict(error)) {
            // Another device changed this draft, or sent or deleted it. Never
            // overwrite that: the next save starts a new draft from the edits
            // still open here, so nothing typed is lost either.
            draftIdRef.current = null;
            draftRevisionRef.current = null;
            if (mountedRef.current) toast.error(t('compose.toast.draftConflict'));
          }
          if (mountedRef.current) setDraftSaveState('error');
          return false;
        }
      };
      return draftSaveQueue.enqueue(save);
    },
    [api, awaitingReplyHeaders, draftSaveQueue, recoveryKey, replyHeaders, saveDraftAsync, t, trailer],
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
  saveToServerRef.current = saveToServer;
  const deleteServerDraftRef = useRef<() => Promise<void>>(async () => undefined);
  useEffect(
    () => () => {
      if (sentRef.current || discardedRef.current) return;
      const { snapshot: last, contentKey: key, hasContent: had, hasUnsavedWork: unsaved } =
        latest.current;
      if (unsaved) void saveToServerRef.current(last, key);
      else if (!had && createdDraftRef.current) void deleteServerDraftRef.current();
    },
    [],
  );

  const visibleSaveState =
    draftSaveState === 'saved' && isDirty ? 'idle' : draftSaveState;
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
      const signature = signatureRef.current;
      if (isBodyBlank(current, signature, isWeb)) {
        const lead = textToEditorContent(text, isWeb);
        updateBody(signature && !isBodyBlank(current, null, isWeb) ? `${lead}${current}` : lead);
        return;
      }
      updateBody(appendTextToBody(current, text, isWeb));
    },
    [updateBody],
  );

  /**
   * The body split into what the user wrote and the signature this composer
   * put under it — while that signature is still intact at the end. Once the
   * user has edited into it, it is their text like the rest.
   */
  const splitSignature = useCallback((content: string) => {
    const signature = signatureRef.current;
    if (signature && content.endsWith(signature)) {
      return { own: content.slice(0, -signature.length), signature };
    }
    return { own: content, signature: '' };
  }, []);

  /** Replace what the user wrote with plain text (an AI rewrite), keeping the signature. */
  const replaceOwnText = useCallback(
    (text: string) => {
      const { signature } = splitSignature(bodyValueRef.current);
      updateBody(`${textToEditorContent(text, isWeb)}${signature}`);
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
    (recipients: NonNullable<ReturnType<typeof validatedRecipients>>) => ({
      ...recipients,
      subject,
      ...bodyParts(body + trailer, isWeb),
      ...(replyHeaders ?? {}),
      attachments:
        attachments.length > 0 ? attachments.map((a) => ({ fileId: a.fileId })) : undefined,
      ...(draftIdRef.current ? { draftId: draftIdRef.current } : {}),
      idempotencyKey,
    }),
    [attachments, body, idempotencyKey, replyHeaders, subject, trailer],
  );

  const send = useCallback(async () => {
    if (awaitingReplyHeaders || sentRef.current) return;
    const recipients = validatedRecipients();
    if (!recipients) return;

    sentRef.current = true;
    await settleSaves();
    if (discardedRef.current) return;
    pendingSendRef.current = sendWithUndo(messagePayload(recipients), {
      onSuccess: () => {
        void clearComposeRecovery(recoveryKey);
        finish();
      },
      // Accepted but NOT delivered. Close — the server holds the message — but
      // keep the local snapshot, marked queued with the session's key, because
      // `queued` includes the case where delivery never happens; pressing Send
      // on it again is the same message to the API.
      onQueued: () => {
        void saveComposeRecovery(recoveryKey, { ...latest.current.snapshot, queued: true });
        finish();
      },
      onError: () => {
        pendingSendRef.current = null;
        sentRef.current = false;
      },
      onCancel: () => {
        pendingSendRef.current = null;
        sentRef.current = false;
      },
    });
  }, [
    awaitingReplyHeaders,
    messagePayload,
    finish,
    recoveryKey,
    sendWithUndo,
    settleSaves,
    validatedRecipients,
  ]);

  const schedule = useCallback(
    async (scheduledDate: Date) => {
      if (awaitingReplyHeaders || sentRef.current) return;
      const recipients = validatedRecipients();
      if (!recipients) return;

      sentRef.current = true;
      await settleSaves();
      sendMessageMutation.mutate(
        { ...messagePayload(recipients), scheduledAt: scheduledDate.toISOString() },
        {
          onSuccess: () => {
            toast.success(
              t('compose.toast.scheduled', {
                time: scheduledDate.toLocaleString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                }),
              }),
            );
            void clearComposeRecovery(recoveryKey);
            finish();
          },
          onError: (err: Error) => {
            sentRef.current = false;
            toast.error(err.message || t('compose.toast.scheduleFailed'));
          },
        },
      );
    },
    [
      awaitingReplyHeaders,
      messagePayload,
      finish,
      recoveryKey,
      sendMessageMutation,
      settleSaves,
      t,
      validatedRecipients,
    ],
  );

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

  deleteServerDraftRef.current = deleteServerDraft;

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
  }, [contentKey, deleteServerDraft, hasContent, hasUnsavedWork, finish, recoveryKey, saveToServer, snapshot, t]);

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
    alreadyQueued,
    sending,
    sendDisabled,
    send,
    schedule,
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
