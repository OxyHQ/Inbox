import { BREAKPOINTS } from '@oxy.so/bloom/styles';
import { useBottomEdgeInset } from '@oxy.so/bloom/layout';
import { Text } from '@oxy.so/bloom/typography';
import { TextFieldInput } from '@oxy.so/bloom/text-field';
import { MailAddressFields } from '@/components/MailAddressFields';
import {
  buildComposeDraftPayload,
  createDraftSaveQueue,
  parseComposeRecipients,
  type ComposeDraftSaveState,
  type ComposeDraftSnapshot,
} from '@/utils/composeDraft';
import { stripHtml } from '@/utils/stripHtml';
import { Button, IconButton } from '@oxy.so/bloom/button';
import {
  RiArrowDownSLine,
  RiSaveLine,
  RiSendPlaneLine,
  RiTimeLine,
} from '@oxy.so/bloom/icons';
import { MailComposeSurface } from '@oxy.so/bloom/mail-compose';
/**
 * Reusable compose / reply / forward form.
 *
 * Supports attachments, Cc/Bcc toggle, and discard confirmation.
 */

import { Dialog, toast, useDialogControl } from '@oxy.so/bloom';
import { Admonition } from '@oxy.so/bloom/admonition';
import type { FileMetadata } from '@oxy.so/core';
import { useOxy } from '@oxy.so/services';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWindowDimensions, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { AiComposeToolbar } from '@/components/AiComposeToolbar';
import { ReplyParentNotice } from '@/components/ReplyParentNotice';
import {
  RichTextEditor,
  type RichTextEditorHandle,
} from '@/components/RichTextEditor';
import { ScheduleSendSheet } from '@/components/ScheduleSendSheet';
import { TemplatePicker } from '@/components/TemplatePicker';
import { useColors } from '@/constants/theme';
import {
  useSaveDraft,
  useSendMessage,
  useSendMessageWithUndo,
} from '@/hooks/mutations/useMessageMutations';
import { useEmailStore } from '@/hooks/useEmail';
import { useGoBack } from '@/hooks/useGoBack';
import { useReplyParent } from '@/hooks/useReplyParent';
import { useTranslation } from '@/lib/i18n';
import type { EmailTemplate } from '@/services/emailApi';
import {
  clearComposeRecovery,
  composeRecoveryStorageKey,
  loadComposeRecovery,
  saveComposeRecovery,
} from '@/utils/composeRecovery';
import { newSendIdempotencyKey } from '@/utils/sendIdempotency';

/**
 * Local composer representation of an attachment. Just enough to render the
 * chip and to map onto the API `{ fileId }` payload — every attachment is a
 * reference into the user's Oxy File Manager.
 */
interface ComposerAttachment {
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

const isWeb = Platform.OS === 'web';

interface ComposeFormProps {
  replyTo?: string;
  forward?: string;
  to?: string;
  cc?: string;
  subject?: string;
  body?: string;
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

export function ComposeForm({
  replyTo,
  forward,
  to: initialTo,
  cc: initialCc,
  subject: initialSubject,
  body: initialBody,
}: ComposeFormProps) {
  // Compose can be opened from a deep link, where there is no history to pop.
  const closeCompose = useGoBack();
  const occupiedBottom = useBottomEdgeInset();
  const { width: viewportWidth } = useWindowDimensions();
  const bottomClearance = viewportWidth < BREAKPOINTS.md ? occupiedBottom : 0;
  const colors = useColors();
  const { t } = useTranslation();

  const { user, showBottomSheet } = useOxy();
  const api = useEmailStore((s) => s._api);
  const { sendWithUndo, isPending: sendPending } = useSendMessageWithUndo();
  const sendMessageMutation = useSendMessage();
  const saveDraftMutation = useSaveDraft();
  const bodyRef = useRef<RichTextEditorHandle>(null);

  // The parent is loaded by its row id only to read its RFC headers; until they
  // are known, nothing that carries them (send, schedule, server draft) runs.
  const replyParent = useReplyParent(replyTo);
  const replyHeaders = replyParent.headers;
  const awaitingReplyHeaders = replyParent.blocksSend;

  // One key per compose session (see utils/sendIdempotency.ts); replaced by the
  // recovered one when this composer resumes an earlier session.
  const [idempotencyKey, setIdempotencyKey] = useState(newSendIdempotencyKey);
  const [alreadyQueued, setAlreadyQueued] = useState(false);

  const [to, setTo] = useState(initialTo || '');
  const [cc, setCc] = useState(initialCc || '');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState(initialSubject || '');
  const [body, setBody] = useState(initialBody || '');
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [signatureLoaded, setSignatureLoaded] = useState(false);
  const [draftSaveState, setDraftSaveState] =
    useState<ComposeDraftSaveState>('idle');
  const [savedDraftKey, setSavedDraftKey] = useState<string | null>(null);
  const [recoveryLoaded, setRecoveryLoaded] = useState(false);
  const [draftSaveQueue] = useState(createDraftSaveQueue);
  const bodyValueRef = useRef(initialBody || '');
  const updateBody = useCallback((nextBody: string) => {
    bodyValueRef.current = nextBody;
    setBody(nextBody);
  }, []);

  const recoveryKey = useMemo(
    () =>
      composeRecoveryStorageKey(
        user?.id,
        replyTo ? `reply:${replyTo}` : forward ? `forward:${forward}` : 'new',
      ),
    [forward, replyTo, user?.id],
  );

  useEffect(() => {
    let cancelled = false;
    const hasServerDraft = Boolean(
      initialTo || initialCc || initialSubject || initialBody,
    );

    void loadComposeRecovery(recoveryKey).then((record) => {
      if (cancelled) return;
      if (record && !hasServerDraft) {
        if (record.snapshot.idempotencyKey)
          setIdempotencyKey(record.snapshot.idempotencyKey);
        setAlreadyQueued(record.snapshot.queued === true);
        setTo(record.snapshot.to);
        setCc(record.snapshot.cc);
        setBcc(record.snapshot.bcc);
        setSubject(record.snapshot.subject);
        updateBody(record.snapshot.body);
        setAttachments(
          (record.snapshot.attachments ?? []).map(({ fileId }) => ({
            fileId,
            name: fileId,
            contentType: 'application/octet-stream',
            size: 0,
          })),
        );
      }
      setRecoveryLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [
    initialBody,
    initialCc,
    initialSubject,
    initialTo,
    recoveryKey,
    updateBody,
  ]);

  // Auto-insert signature from settings
  useEffect(() => {
    if (!api || signatureLoaded) return;

    const loadSignature = async () => {
      try {
        const settings = await api.getSettings();
        if (settings.signature && !bodyValueRef.current.trim()) {
          // Add signature with separator
          updateBody(`\n\n--\n${settings.signature}`);
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : t('compose.toast.signatureFailed');
        toast.error(message);
      }
      setSignatureLoaded(true);
    };

    loadSignature();
  }, [api, signatureLoaded, t, updateBody]);

  const draftIdRef = useRef<string | null>(null);
  const draftRevisionRef = useRef<number | null>(null);
  const sentRef = useRef(false);
  const mountedRef = useRef(true);

  const fromAddress = user?.username ? `${user.username}@oxy.so` : '';
  const sending = sendPending || sendMessageMutation.isPending;
  const sendDisabled = sending || awaitingReplyHeaders;
  const hasContent = Boolean(
    to.trim() || subject.trim() || body.trim() || attachments.length > 0,
  );
  const draftSnapshot = useMemo<ComposeDraftSnapshot>(
    () => ({
      to,
      cc,
      bcc,
      subject,
      body,
      attachments: attachments.map((attachment) => ({
        fileId: attachment.fileId,
      })),
      replyTo,
      idempotencyKey,
      ...(alreadyQueued ? { queued: true } : {}),
    }),
    [
      to,
      cc,
      bcc,
      subject,
      body,
      attachments,
      replyTo,
      idempotencyKey,
      alreadyQueued,
    ],
  );
  const draftSnapshotKey = useMemo(
    () => JSON.stringify(draftSnapshot),
    [draftSnapshot],
  );
  const saveDraftAsync = saveDraftMutation.mutateAsync;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const saveDraftSnapshot = useCallback(
    (snapshot: ComposeDraftSnapshot, snapshotKey: string): Promise<boolean> => {
      const save = async (): Promise<boolean> => {
        // A server draft of a reply without its threading headers would be sent
        // unthreaded later. The local recovery snapshot still keeps the text.
        if (!api || sentRef.current || awaitingReplyHeaders) return false;
        if (mountedRef.current) setDraftSaveState('saving');
        try {
          const draft = await saveDraftAsync({
            ...buildComposeDraftPayload(
              snapshot,
              draftIdRef.current ?? undefined,
              isWeb,
              replyHeaders,
            ),
            ...(draftIdRef.current && draftRevisionRef.current
              ? { expectedRevision: draftRevisionRef.current }
              : {}),
          });
          draftIdRef.current = draft._id;
          draftRevisionRef.current = draft.draftRevision;
          if (mountedRef.current) {
            setSavedDraftKey(snapshotKey);
            setDraftSaveState('saved');
          }
          void clearComposeRecovery(recoveryKey);
          return true;
        } catch (error) {
          if (isDraftConflict(error)) {
            // Do not overwrite the other device's version. The next autosave
            // creates a new draft copy from the edits still open in this
            // composer, while the user can continue working uninterrupted.
            draftIdRef.current = null;
            draftRevisionRef.current = null;
            if (mountedRef.current) {
              toast.error(t('common.notSaved'));
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
    ],
  );

  useEffect(() => {
    if (!api || !hasContent || sending || sentRef.current) return;
    const timer = setTimeout(() => {
      void saveDraftSnapshot(draftSnapshot, draftSnapshotKey);
    }, 8_000);
    return () => clearTimeout(timer);
  }, [
    api,
    hasContent,
    sending,
    draftSnapshot,
    draftSnapshotKey,
    saveDraftSnapshot,
  ]);

  useEffect(() => {
    if (!recoveryLoaded || !hasContent || sending || sentRef.current) return;
    const timer = setTimeout(() => {
      void saveComposeRecovery(recoveryKey, draftSnapshot);
    }, 750);
    return () => clearTimeout(timer);
  }, [draftSnapshot, hasContent, recoveryKey, recoveryLoaded, sending]);

  const visibleDraftSaveState =
    draftSaveState === 'saved' && savedDraftKey !== draftSnapshotKey
      ? 'idle'
      : draftSaveState;
  const draftStatusLabel =
    visibleDraftSaveState === 'saving'
      ? t('common.saving')
      : visibleDraftSaveState === 'saved'
        ? t('common.saved')
        : visibleDraftSaveState === 'error'
          ? t('common.notSaved')
          : null;

  // Recipient parsing + validation is centralised in the Zod-backed
  // `parseRecipientList` (schemas/emailSchemas.ts) so the composer and any
  // future caller share one definition of a valid address.
  const getValidatedRecipients = useCallback(() => {
    if (!to.trim()) {
      toast.error(t('compose.toast.addRecipient'));
      return null;
    }

    const fields = [
      { label: 'To', value: to },
      { label: 'Cc', value: cc },
      { label: 'Bcc', value: bcc },
    ];
    const parsed = fields.map((field) => ({
      ...field,
      result: parseComposeRecipients(field.value),
    }));
    const invalidField = parsed.find(
      (field) => field.result.invalid.length > 0,
    );
    if (invalidField) {
      toast.error(
        `${t('compose.toast.invalidEmail')} (${invalidField.result.invalid.join(', ')})`,
      );
      return null;
    }

    if (parsed[0].result.addresses.length === 0) {
      toast.error(t('compose.toast.invalidEmail'));
      return null;
    }

    return {
      to: parsed[0].result.addresses,
      cc:
        parsed[1].result.addresses.length > 0
          ? parsed[1].result.addresses
          : undefined,
      bcc:
        parsed[2].result.addresses.length > 0
          ? parsed[2].result.addresses
          : undefined,
    };
  }, [to, cc, bcc, t]);

  // Append a selected file to the attachment list, de-duplicating by fileId so
  // that picking the same Cloud file twice doesn't create a duplicate chip.
  const appendAttachments = useCallback((files: FileMetadata[]) => {
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

  const handleAttachFile = useCallback(() => {
    if (!showBottomSheet) return;
    showBottomSheet({
      screen: 'FileManagement',
      props: {
        selectMode: true,
        multiSelect: true,
        afterSelect: 'back',
        onSelect: (file: FileMetadata) => {
          appendAttachments([file]);
        },
        onConfirmSelection: (files: FileMetadata[]) => {
          appendAttachments(files);
        },
      },
    });
  }, [showBottomSheet, appendAttachments]);

  const handleRemoveAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSend = useCallback(() => {
    if (awaitingReplyHeaders) return;
    const recipients = getValidatedRecipients();
    if (!recipients) return;

    sentRef.current = true;
    sendWithUndo(
      {
        to: recipients.to,
        cc: recipients.cc,
        bcc: recipients.bcc,
        subject,
        text: isWeb ? stripHtml(body) : body,
        html: isWeb ? body : undefined,
        ...(replyHeaders ?? {}),
        attachments:
          attachments.length > 0
            ? attachments.map((a) => ({ fileId: a.fileId }))
            : undefined,
        idempotencyKey,
      },
      {
        onSuccess: () => {
          void clearComposeRecovery(recoveryKey);
          closeCompose();
        },
        // Accepted but NOT delivered. Close the composer — the server holds the
        // message and the delivery queue tracks it — but keep the local
        // crash-recovery snapshot, because `queued` includes the case where
        // delivery never happens and the text would otherwise be gone.
        //
        // The snapshot is marked queued and keeps the session key, so reopening
        // it says so, and pressing Send again is the same message to the API.
        onQueued: () => {
          void saveComposeRecovery(recoveryKey, {
            ...draftSnapshot,
            queued: true,
          });
          closeCompose();
        },
        onError: () => {
          sentRef.current = false;
        },
      },
    );
  }, [
    attachments,
    awaitingReplyHeaders,
    body,
    closeCompose,
    draftSnapshot,
    getValidatedRecipients,
    idempotencyKey,
    recoveryKey,
    replyHeaders,
    sendWithUndo,
    subject,
  ]);

  const handleSaveDraft = useCallback(() => {
    if (!hasContent) {
      void clearComposeRecovery(recoveryKey);
      closeCompose();
      return;
    }
    void saveDraftSnapshot(draftSnapshot, draftSnapshotKey).then((saved) => {
      if (saved) {
        closeCompose();
      } else {
        toast.error(t('common.notSaved'));
      }
    });
  }, [
    closeCompose,
    draftSnapshot,
    draftSnapshotKey,
    hasContent,
    recoveryKey,
    saveDraftSnapshot,
    t,
  ]);

  const saveDraftDialog = useDialogControl();

  const handleClose = useCallback(() => {
    if (hasContent) {
      void saveComposeRecovery(recoveryKey, draftSnapshot);
      saveDraftDialog.open();
    } else {
      void clearComposeRecovery(recoveryKey);
      closeCompose();
    }
  }, [closeCompose, draftSnapshot, hasContent, recoveryKey, saveDraftDialog]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Handle AI-suggested subject line
  const handleSubjectSuggested = useCallback((suggestedSubject: string) => {
    setSubject(suggestedSubject);
  }, []);

  // Handle template selection — insert into compose fields
  const handleTemplateSelect = useCallback(
    (template: EmailTemplate) => {
      if (!subject.trim() && template.subject) {
        setSubject(template.subject);
      }
      if (!body.trim()) {
        if (isWeb && bodyRef.current) {
          bodyRef.current.setContent(template.body);
        } else {
          updateBody(template.body);
        }
      } else {
        // Append template body
        const newBody = body + '\n' + template.body;
        if (isWeb && bodyRef.current) {
          bodyRef.current.setContent(newBody);
        } else {
          updateBody(newBody);
        }
      }
    },
    [subject, body, updateBody],
  );

  // Handle body changes from AI toolbar — on web, insert into contentEditable
  const handleAiBodyChange = useCallback(
    (text: string) => {
      if (isWeb && bodyRef.current) {
        bodyRef.current.setContent(text);
      } else {
        updateBody(text);
      }
    },
    [updateBody],
  );

  // Schedule Send state
  const [showScheduleSheet, setShowScheduleSheet] = useState(false);
  const sendMenuControl = useDialogControl();

  const handleScheduleSend = useCallback(
    (scheduledDate: Date) => {
      if (awaitingReplyHeaders) return;
      const recipients = getValidatedRecipients();
      if (!recipients) return;

      sentRef.current = true;
      sendMessageMutation.mutate(
        {
          to: recipients.to,
          cc: recipients.cc,
          bcc: recipients.bcc,
          subject,
          text: isWeb ? stripHtml(body) : body,
          html: isWeb ? body : undefined,
          ...(replyHeaders ?? {}),
          attachments:
            attachments.length > 0
              ? attachments.map((a) => ({ fileId: a.fileId }))
              : undefined,
          scheduledAt: scheduledDate.toISOString(),
          idempotencyKey,
        },
        {
          onSuccess: () => {
            const timeStr = scheduledDate.toLocaleString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            });
            toast.success(`Email scheduled for ${timeStr}`);
            void clearComposeRecovery(recoveryKey);
            closeCompose();
          },
          onError: (err: Error) => {
            sentRef.current = false;
            toast.error(err.message || t('compose.toast.scheduleFailed'));
          },
        },
      );
    },
    [
      attachments,
      awaitingReplyHeaders,
      body,
      closeCompose,
      getValidatedRecipients,
      idempotencyKey,
      recoveryKey,
      replyHeaders,
      sendMessageMutation,
      subject,
      t,
    ],
  );

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <MailComposeSurface
        variant="sheet"
        title={
          replyTo
            ? t('compose.titleReply')
            : forward
              ? t('compose.titleForward')
              : t('compose.titleCompose')
        }
        onClose={handleClose}
        onSend={handleSend}
        sending={sending}
        sendDisabled={sendDisabled}
        onAttach={handleAttachFile}
        attachments={attachments.map((item) => ({
          id: item.fileId,
          name: item.name,
          caption: formatSize(item.size),
        }))}
        onAttachmentRemove={(id) =>
          handleRemoveAttachment(
            attachments.findIndex((item) => item.fileId === id),
          )
        }
        footer={
          <View className="flex-row items-center gap-1">
            <TemplatePicker onSelect={handleTemplateSelect} />
            <IconButton
              accessibilityLabel={t('compose.actions.saveDraft')}
              onPress={handleSaveDraft}
              icon={<RiSaveLine />}
            />
            <IconButton
              accessibilityLabel={t('compose.actions.moreSendOptions')}
              onPress={() => sendMenuControl.open()}
              disabled={sendDisabled}
              icon={<RiArrowDownSLine />}
            />
          </View>
        }
        strings={{
          send: t('compose.actions.send'),
          sending: t('common.sending'),
          attach: t('compose.dropZone'),
          close: t('common.close'),
        }}
        style={{ flex: 1, paddingBottom: bottomClearance }}
      >
        <Dialog
          control={sendMenuControl}
          label={t('compose.actions.sendOptions')}
        >
          <View style={{ gap: 8 }}>
            <Button
              disabled={sendDisabled}
              appearance="subtle"
              leading={<RiSendPlaneLine />}
              onPress={() => {
                sendMenuControl.close();
                handleSend();
              }}
            >
              {t('compose.actions.sendNow')}
            </Button>
            <Button
              disabled={sendDisabled}
              appearance="subtle"
              leading={<RiTimeLine />}
              onPress={() => {
                sendMenuControl.close();
                setShowScheduleSheet(true);
              }}
            >
              {t('compose.actions.scheduleSend')}
            </Button>
          </View>
        </Dialog>

        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
          <ReplyParentNotice state={replyParent} />

          {alreadyQueued && (
            <View>
              <Admonition type="info">{t('compose.queuedNotice')}</Admonition>
            </View>
          )}

          <TextFieldInput
            label={t('compose.fields.from')}
            value={fromAddress}
            editable={false}
          />

          <MailAddressFields
            to={to}
            onToChange={setTo}
            cc={cc}
            onCcChange={setCc}
            bcc={bcc}
            onBccChange={setBcc}
            subject={subject}
            onSubjectChange={setSubject}
          />
          {draftStatusLabel && (
            <Text
              accessibilityLiveRegion="polite"
              style={{
                color:
                  visibleDraftSaveState === 'error'
                    ? colors.error
                    : colors.secondaryText,
              }}
            >
              {draftStatusLabel}
            </Text>
          )}

          {/* AI Compose Toolbar */}
          <AiComposeToolbar
            body={body}
            onBodyChange={handleAiBodyChange}
            onSubjectSuggested={
              !subject.trim() ? handleSubjectSuggested : undefined
            }
          />

          {/* Body */}
          <RichTextEditor
            ref={bodyRef}
            value={body}
            onChange={updateBody}
            placeholder={t('compose.placeholders.body')}
          />
        </ScrollView>
      </MailComposeSurface>

      {/* Schedule Send Sheet */}
      <ScheduleSendSheet
        visible={showScheduleSheet}
        onClose={() => setShowScheduleSheet(false)}
        onSchedule={handleScheduleSend}
      />

      {/* Save as draft confirmation */}
      <Dialog
        control={saveDraftDialog}
        onClose={() => saveDraftDialog.close()}
        title={t('compose.saveDraftPrompt.title')}
        description={t('compose.saveDraftPrompt.description')}
        actions={[
          { label: t('common.save'), onPress: handleSaveDraft },
          {
            label: t('compose.actions.discard'),
            color: 'destructive',
            onPress: () => {
              void clearComposeRecovery(recoveryKey);
              closeCompose();
            },
          },
          { label: t('common.cancel'), color: 'cancel' },
        ]}
      />
    </KeyboardAvoidingView>
  );
}
