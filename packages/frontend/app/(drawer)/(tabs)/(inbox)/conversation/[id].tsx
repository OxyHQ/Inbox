import { useIsDesktopLayout } from '@/hooks/useIsDesktopLayout';
/**
 * Conversation (message detail) route — /conversation/:id
 *
 * The same routed detail stays mounted as the shell switches between one and two panes.
 */

import { useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect } from 'react';

import { MessageDetail } from '@/components/MessageDetail';
import { useThread } from '@/hooks/queries/useThread';
import { useEmailStore } from '@/hooks/useEmail';
import { useTranslation } from '@/lib/i18n';

export default function ConversationScreen() {
  const isDesktop = useIsDesktopLayout();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();

  const { data: thread } = useThread(id);
  const subject = thread?.messages[0]?.subject;
  const pageTitle = subject
    ? `${subject} ${t('app.titleSuffix')}`
    : `${t('tabs.inbox')} ${t('app.titleSuffix')}`;

  // Sync selected message ID for list highlighting
  useEffect(() => {
    if (id) {
      useEmailStore.setState({ selectedMessageId: id });
    }
    return () => {
      useEmailStore.setState({ selectedMessageId: null });
    };
  }, [id]);

  if (!id) return null;

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
      </Head>
      <MessageDetail mode={isDesktop ? 'embedded' : 'standalone'} messageId={id} />
    </>
  );
}
