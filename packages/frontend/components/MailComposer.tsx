import { Dialog, toast, useDialogControl } from '@oxy.so/bloom';
import { Admonition } from '@oxy.so/bloom/admonition';
import { Button, IconButton } from '@oxy.so/bloom/button';
import {
  RiArrowDownSLine,
  RiSaveLine,
  RiSendPlaneLine,
  RiTimeLine,
} from '@oxy.so/bloom/icons';
import { MailComposeSurface } from '@oxy.so/bloom/mail-compose';
import { MailQuoteToggle } from '@oxy.so/bloom/mail-thread';
import { TextFieldInput } from '@oxy.so/bloom/text-field';
import { Text } from '@oxy.so/bloom/typography';
/**
 * The one composer UI. A new message, a reply, a forward and a reopened draft
 * all render this, whether full screen (`ComposeForm`) or inside a thread
 * (`InlineReply`), so what one can do the other can too: attachments,
 * templates, AI writing, save draft, scheduled send, discard.
 *
 * The caller owns the compose session (`useComposeSession`) and what is
 * specific to where it is shown: the title, the read-only trailer (quote or
 * forwarded message) and anything above the editor (`lead`).
 */

import type { FileMetadata } from '@oxy.so/core';
import { useOxy } from '@oxy.so/services';
import { type ReactNode, useCallback, useRef, useState } from 'react';
import { Platform, ScrollView, type StyleProp, View, type ViewStyle } from 'react-native';

import { AiComposeToolbar } from '@/components/AiComposeToolbar';
import { MailAddressFields } from '@/components/MailAddressFields';
import { RichTextEditor } from '@/components/RichTextEditor';
import { ScheduleSendSheet } from '@/components/ScheduleSendSheet';
import { TemplatePicker } from '@/components/TemplatePicker';
import { useColors } from '@/constants/theme';
import type { useComposeSession } from '@/hooks/useComposeSession';
import { useTranslation } from '@/lib/i18n';
import type { EmailTemplate } from '@/services/emailApi';
import { editorContentToText } from '@/utils/composeBody';

const isWeb = Platform.OS === 'web';

export type ComposeSession = ReturnType<typeof useComposeSession>;

interface MailComposerProps {
  session: ComposeSession;
  title: string;
  /** Read-only text sent after the editable body: a quote or a forward. */
  trailer: string;
  /**
   * `screen` fills its parent and scrolls its own content, and asks before
   * closing over unsaved changes. `inline` sits in a scrolling thread and
   * closing keeps what was written as a draft, without a dialog.
   */
  layout: 'screen' | 'inline';
  /** Shown above the fields, e.g. the reply-parent notice or reply chips. */
  lead?: ReactNode;
  placeholder: string;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function MailComposer({
  session,
  title,
  trailer,
  layout,
  lead,
  placeholder,
  autoFocus,
  style,
}: MailComposerProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const { user, showBottomSheet } = useOxy();
  const fromAddress = user?.username ? `${user.username}@oxy.so` : '';

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
    // Nothing unsaved, already on its way, or inline in a thread: close and
    // keep the draft. Otherwise ask whether to keep it.
    if (layout === 'screen' && session.hasContent && session.isDirty && !session.sending) {
      saveDraftDialog.open();
    } else {
      void session.saveAndClose();
    }
  }, [layout, saveDraftDialog, session]);

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

  const content = (
    <>
      {lead}

      {session.alreadyQueued && (
        <View>
          <Admonition type="info">{t('compose.queuedNotice')}</Admonition>
        </View>
      )}

      <TextFieldInput label={t('compose.fields.from')} value={fromAddress} editable={false} />

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
          style={{ color: session.draftSaveError ? colors.error : colors.secondaryText }}
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
          // A rewrite replaces formatting and links with plain text, so what
          // was there is always one tap away.
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
        placeholder={placeholder}
        autoFocus={autoFocus}
      />

      {trailer ? (
        <MailQuoteToggle>
          <Text selectable>{editorContentToText(trailer, isWeb)}</Text>
        </MailQuoteToggle>
      ) : null}
    </>
  );

  return (
    <>
      <MailComposeSurface
        variant="sheet"
        title={title}
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
        style={style}
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

        {layout === 'screen' ? (
          <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
            {content}
          </ScrollView>
        ) : (
          content
        )}
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
    </>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
