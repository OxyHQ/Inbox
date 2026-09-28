import { useIsDesktopLayout } from '@/hooks/useIsDesktopLayout';
/**
 * Conversation detail within search context — /search/conversation/:id
 *
 * Desktop: rendered in Slot (right pane of split-view), embedded mode.
 * Mobile: pushed onto Stack, standalone mode with back button.
 */

import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { MessageDetail } from '@/components/MessageDetail';
import { useEmailStore } from '@/hooks/useEmail';

export default function SearchConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isDesktop = useIsDesktopLayout();

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
