import { useIsDesktopLayout } from '@/hooks/useIsDesktopLayout';
/**
 * Conversation detail within search context — /search/conversation/:id
 *
 * The same routed detail stays mounted as the shell switches between one and two panes.
 */

import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { MessageDetail } from '@/components/MessageDetail';
import { useEmailStore } from '@/hooks/useEmail';

export default function SearchConversationScreen() {
  const isDesktop = useIsDesktopLayout();
  const { id } = useLocalSearchParams<{ id: string }>();

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
    <MessageDetail
      mode={isDesktop ? 'embedded' : 'standalone'}
      messageId={id}
    />
  );
}
