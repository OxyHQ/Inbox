import { BREAKPOINTS } from '@oxy.so/bloom/styles';
import { useBottomEdgeInset } from '@oxy.so/bloom/layout';
import { EmptyState } from '@oxy.so/bloom/empty-state';
import { Loading } from '@oxy.so/bloom/loading';
/**
 * The full composer: a new message, a reply, a forward, or a saved draft
 * reopened to finish and send.
 *
 * What is being composed is loaded first — the draft, or the message being
 * forwarded — and only then is the session (`useComposeSession`) started from
 * it, so its fields are seeded once from real data rather than patched in after.
 * The UI itself is `MailComposer`, the same one an inline reply renders.
 */

import { useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { EmptyStateSticker } from '@/components/EmptyStateSticker';
import { MailComposer } from '@/components/MailComposer';
import { ReplyParentNotice } from '@/components/ReplyParentNotice';
import { useMessage } from '@/hooks/queries/useMessage';
import { useComposeSession } from '@/hooks/useComposeSession';
import { useGoBack } from '@/hooks/useGoBack';
import { useReplyParent } from '@/hooks/useReplyParent';
import { useTranslation } from '@/lib/i18n';
import type { Message } from '@/services/emailApi';
import { forwardedBody, textToEditorContent } from '@/utils/composeBody';
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
  const { t } = useTranslation();

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

  const isReply = Boolean(replyTo || (draft && replyHeaders));

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <MailComposer
        session={session}
        layout="screen"
        title={
          isReply
            ? t('compose.titleReply')
            : forwarded
              ? t('compose.titleForward')
              : draft
                ? t('compose.titleDraft')
                : t('compose.titleCompose')
        }
        trailer={trailer}
        lead={!draft && <ReplyParentNotice state={replyParent} />}
        placeholder={t('compose.placeholders.body')}
        style={{ flex: 1, paddingBottom: bottomClearance }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
