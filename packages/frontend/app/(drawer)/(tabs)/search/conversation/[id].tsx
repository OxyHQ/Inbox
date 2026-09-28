/**
 * Conversation detail within search context — /search/conversation/:id
 *
 * One routed page inside Bloom’s content panel, with back navigation at every width.
 */

import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { MessageDetail } from '@/components/MessageDetail';
import { useEmailStore } from '@/hooks/useEmail';

export default function SearchConversationScreen() {
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
      mode="standalone"
      messageId={id}
    />
  );
}
