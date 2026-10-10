import { BREAKPOINTS } from '@oxy.so/bloom/styles';
import { useBottomEdgeInset } from '@oxy.so/bloom/layout';
import { Text } from '@oxy.so/bloom/typography';
import { TextFieldInput } from '@oxy.so/bloom/text-field';
import { Button, IconButton } from '@oxy.so/bloom/button';
import {
  RiArrowDownSLine,
  RiSaveLine,
  RiSendPlaneLine,
  RiTimeLine,
} from '@oxy.so/bloom/icons';
import { MailComposeSurface } from '@oxy.so/bloom/mail-compose';
import { MailQuoteToggle } from '@oxy.so/bloom/mail-thread';
import { EmptyState } from '@oxy.so/bloom/empty-state';
import { Loading } from '@oxy.so/bloom/loading';
/**
 * The full composer: a new message, a reply, a forward, or a saved draft
 * reopened to finish and send.
 *
 * What is being composed is loaded first — the draft, or the message being
 * forwarded — and only then is the session (`useComposeSession`) started from
 * it, so its fields are seeded once from real data rather than patched in after.
 */

import { Dialog, toast, useDialogControl } from '@oxy.so/bloom';
import { Admonition } from '@oxy.so/bloom/admonition';
import type { FileMetadata } from '@oxy.so/core';
import { useOxy } from '@oxy.so/services';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { AiComposeToolbar } from '@/components/AiComposeToolbar';
import { EmptyStateSticker } from '@/components/EmptyStateSticker';
import { MailAddressFields } from '@/components/MailAddressFields';
import { ReplyParentNotice } from '@/components/ReplyParentNotice';
import { RichTextEditor } from '@/components/RichTextEditor';
import { ScheduleSendSheet } from '@/components/ScheduleSendSheet';
import { TemplatePicker } from '@/components/TemplatePicker';
import { useColors } from '@/constants/theme';
import { useMessage } from '@/hooks/queries/useMessage';
import { useComposeSession } from '@/hooks/useComposeSession';
import { useGoBack } from '@/hooks/useGoBack';
import { useReplyParent } from '@/hooks/useReplyParent';
import { useTranslation } from '@/lib/i18n';
import type { EmailTemplate, Message } from '@/services/emailApi';
import {
  editorContentToText,
  forwardedBody,
  textToEditorContent,
} from '@/utils/composeBody';
import { formatQuoteDate } from '@/utils/quoteDate';
import { draftReplyHeaders } from '@/utils/replyHeaders';

const isWeb = Platform.OS === 'web';

interface ComposeFormProps {
  /** Row id of a saved draft to reopen. */
  draftId?: string;
  replyTo?: string;
  forward?: string;
  to?: string;
  cc?: string;
  subject?: string;
  body?: string;
}

export function ComposeForm({ draftId, forward, ...props }: ComposeFormProps) {
  const closeCompose = useGoBack();
  const { t } = useTranslation();
  // Compose by draft id wins: a draft already holds its recipients, its body
  // and — for a reply — its threading headers.
  const draftQuery = useMessage(draftId);
  const forwardQuery = useMessage(draftId ? undefined : forward);
  const source = draftId ? draftQuery : forward ? forwardQuery : null;

  if (source && !source.data) {
    if (source.isError || (source.isFetched && !source.isFetching)) {
      return (
        <ComposeLoadError
          onRetry={() => void source.refetch()}
          onClose={closeCompose}
          title={t(draftId ? 'compose.draftLoadError' : 'ui.message.loadError')}
        />
      );
    }
    return (
      <View style={styles.centered}>
        <Loading />
      </View>
    );
  }

  if (draftId && draftQuery.data && !draftQuery.data.flags.draft) {
    // Sent or moved out of Drafts since the link to it was made.
    return (
      <ComposeLoadError onClose={closeCompose} title={t('compose.draftGone')} />
    );
  }

  return (
    <ComposeSessionForm
      {...props}
      draft={draftId ? (draftQuery.data ?? undefined) : undefined}
      forwarded={!draftId && forward ? (forwardQuery.data ?? undefined) : undefined}
      closeCompose={closeCompose}
    />
  );
}

function ComposeLoadError({
  title,
  onRetry,
  onClose,
}: {
  title: string;
  onRetry?: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="flex-1">
      <EmptyState
        illustration={<EmptyStateSticker name={onRetry ? 'loadError' : 'notFound'} />}
        title={title}
        action={
          onRetry
            ? { label: t('common.retry'), onPress: onRetry }
            : { label: t('common.close'), onPress: onClose }
        }
      />
    </View>
  );
}

function ComposeSessionForm({
  replyTo,
  to: initialTo,
  cc: initialCc,
  subject: initialSubject,
  body: initialBody,
  draft,
  forwarded,
  closeCompose,
}: Omit<ComposeFormProps, 'draftId' | 'forward'> & {
  draft?: Message;
  forwarded?: Message;
  closeCompose: () => void;
}) {
  const occupiedBottom = useBottomEdgeInset();
  const { width: viewportWidth } = useWindowDimensions();
  const bottomClearance = viewportWidth < BREAKPOINTS.md ? occupiedBottom : 0;
  const colors = useColors();
  const { t } = useTranslation();
  const { user, showBottomSheet } = useOxy();

  // A reply's parent is loaded by its row id only to read its RFC headers. A
  // reopened draft already carries them.
  const replyParent = useReplyParent(draft ? undefined : replyTo);
  const replyHeaders = draft ? draftReplyHeaders(draft) : replyParent.headers;

  // The forwarded message follows the editable body, read-only, as it is sent.
  const trailer = useMemo(
    () =>
      forwarded
        ? forwardedBody(
            forwarded,
            t('inlineReply.forwardHeader', {
              from: forwarded.from.name || forwarded.from.address,
              date: formatQuoteDate(forwarded.date),
              subject: forwarded.subject,
              to: forwarded.to.map((a) => a.name || a.address).join(', '),
            }),
            isWeb,
          )
        : '',
    [forwarded, t],
  );

  const session = useComposeSession({
    recoveryIdentity: draft
      ? `draft:${draft._id}`
      : replyTo
        ? `reply:${replyTo}`
        : forwarded
          ? `forward:${forwarded._id}`
          : 'new',
    draft,
    initial: {
      to: initialTo,
      cc: initialCc,
      subject:
        initialSubject ??
        (forwarded
          ? forwarded.subject.startsWith('Fwd:')
            ? forwarded.subject
            : `Fwd: ${forwarded.subject}`
          : undefined),
      body: initialBody ? textToEditorContent(initialBody, isWeb) : undefined,
    },
    replyTo,
    replyHeaders,
    awaitingReplyHeaders: replyParent.blocksSend,
    trailer,
    insertSignature: !draft,
    onFinished: closeCompose,
  });

  const fromAddress = user?.username ? `${user.username}@oxy.so` : '';
  const isReply = Boolean(replyTo || (draft && replyHeaders));

  const handleAttachFile = useCallback(() => {
    if (!showBottomSheet) return;
    showBottomSheet({
      screen: 'FileManagement',
      props: {
        selectMode: true,
        multiSelect: true,
        afterSelect: 'back',
        onSelect: (file: FileMetadata) => session.addFiles([file]),
        onConfirmSelection: (files: FileMetadata[]) => session.addFiles(files),
      },
    });
  }, [showBottomSheet, session]);

  const saveDraftDialog = useDialogControl();
  const discardDialog = useDialogControl();
  const sendMenuControl = useDialogControl();
  const [showScheduleSheet, setShowScheduleSheet] = useState(false);

  const handleClose = useCallback(() => {
    // Nothing unsaved: close. Otherwise ask whether to keep it.
    if (session.hasContent && session.isDirty) {
      saveDraftDialog.open();
    } else {
      void session.saveAndClose();
    }
  }, [saveDraftDialog, session]);

  const handleTemplateSelect = useCallback(
    (template: EmailTemplate) => {
      if (!session.subject.trim() && template.subject) {
        session.setSubject(template.subject);
      }
      session.insertText(template.body);
    },
    [session],
  );

  // The body as it was before an AI operation, for Undo and for a failure.
  const aiOriginal = useRef<string | null>(null);

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <MailComposeSurface
        variant="sheet"
        title={
          isReply
            ? t('compose.titleReply')
            : forwarded
              ? t('compose.titleForward')
              : draft
                ? t('compose.titleDraft')
                : t('compose.titleCompose')
        }
        onClose={handleClose}
        onSend={() => void session.send()}
        sending={session.sending}
        sendDisabled={session.sendDisabled}
        onDiscard={() => discardDialog.open()}
        onAttach={handleAttachFile}
        attachments={session.attachments.map((item) => ({
          id: item.fileId,
          name: item.name,
          caption: formatSize(item.size),
        }))}
        onAttachmentRemove={session.removeAttachment}
        footer={
          <View className="flex-row items-center gap-1">
            <TemplatePicker onSelect={handleTemplateSelect} />
            <IconButton
              accessibilityLabel={t('compose.actions.saveDraft')}
              onPress={() => void session.saveAndClose()}
              icon={<RiSaveLine />}
            />
            <IconButton
              accessibilityLabel={t('compose.actions.moreSendOptions')}
              onPress={() => sendMenuControl.open()}
              disabled={session.sendDisabled}
              icon={<RiArrowDownSLine />}
            />
          </View>
        }
        strings={{
          send: t('compose.actions.send'),
          sending: t('common.sending'),
          attach: t('compose.dropZone'),
          close: t('common.close'),
          discard: t('compose.actions.discardDraft'),
        }}
        style={{ flex: 1, paddingBottom: bottomClearance }}
      >
        <Dialog control={sendMenuControl} label={t('compose.actions.sendOptions')}>
          <View style={{ gap: 8 }}>
            <Button
              disabled={session.sendDisabled}
              appearance="subtle"
              leading={<RiSendPlaneLine />}
              onPress={() => {
                sendMenuControl.close();
                void session.send();
              }}
            >
              {t('compose.actions.sendNow')}
            </Button>
            <Button
              disabled={session.sendDisabled}
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
          {!draft && <ReplyParentNotice state={replyParent} />}

          {session.alreadyQueued && (
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
            to={session.to}
            onToChange={session.setTo}
            cc={session.cc}
            onCcChange={session.setCc}
            bcc={session.bcc}
            onBccChange={session.setBcc}
            subject={session.subject}
            onSubjectChange={session.setSubject}
          />
          {session.draftStatusLabel && (
            <Text
              accessibilityLiveRegion="polite"
              style={{
                color: session.draftSaveError ? colors.error : colors.secondaryText,
              }}
            >
              {session.draftStatusLabel}
            </Text>
          )}

          <AiComposeToolbar
            text={session.ownText}
            onBegin={() => {
              aiOriginal.current = session.body;
            }}
            onPreview={session.replaceOwnText}
            onCommit={(text) => {
              const previous = aiOriginal.current;
              aiOriginal.current = null;
              session.replaceOwnText(text);
              // A rewrite replaces formatting and links with plain text, so
              // what was there is always one tap away.
              if (previous !== null) {
                toast(t('ai.toast.applied'), {
                  action: { label: t('common.undo'), onClick: () => session.updateBody(previous) },
                } as Record<string, unknown>);
              }
            }}
            onAbort={() => {
              if (aiOriginal.current !== null) session.updateBody(aiOriginal.current);
              aiOriginal.current = null;
            }}
            onSubjectSuggested={!session.subject.trim() ? session.setSubject : undefined}
          />

          <RichTextEditor
            value={session.body}
            onChange={session.updateBody}
            placeholder={t('compose.placeholders.body')}
          />

          {trailer ? (
            <MailQuoteToggle>
              <Text selectable>{editorContentToText(trailer, isWeb)}</Text>
            </MailQuoteToggle>
          ) : null}
        </ScrollView>
      </MailComposeSurface>

      <ScheduleSendSheet
        visible={showScheduleSheet}
        onClose={() => setShowScheduleSheet(false)}
        onSchedule={(date) => void session.schedule(date)}
      />

      <Dialog
        control={saveDraftDialog}
        onClose={() => saveDraftDialog.close()}
        title={t('compose.saveDraftPrompt.title')}
        description={t('compose.saveDraftPrompt.description')}
        actions={[
          { label: t('common.save'), onPress: () => void session.saveAndClose() },
          {
            label: t('compose.actions.discard'),
            color: 'destructive',
            onPress: () => void session.discardChanges(),
          },
          { label: t('common.cancel'), color: 'cancel' },
        ]}
      />

      <Dialog
        control={discardDialog}
        onClose={() => discardDialog.close()}
        title={t('compose.discardDraftPrompt.title')}
        description={t('compose.discardDraftPrompt.description')}
        actions={[
          {
            label: t('compose.actions.discardDraft'),
            color: 'destructive',
            onPress: () => void session.discardDraft(),
          },
          { label: t('common.cancel'), color: 'cancel' },
        ]}
      />
    </KeyboardAvoidingView>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
