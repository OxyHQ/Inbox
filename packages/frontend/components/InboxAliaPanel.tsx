import { AliaChatContent } from '@alia.onl/sdk';
import { AgentAvatarProvider } from '@oxy.so/bloom/agent-avatar';
import { useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from '@/lib/i18n';

/** Alia's own conversation screen (the SDK's `AliaChatContent`), where no message is open. */
export default function InboxAliaPanel() {
  const { t } = useTranslation();
  const welcomeSuggestions = useMemo(
    () => [
      { id: 'unread', text: t('inbox.aliaSuggestions.unread.prompt') },
      { id: 'today-summary', text: t('inbox.aliaSuggestions.todaysSummary.prompt') },
      { id: 'with-attachments', text: t('inbox.aliaSuggestions.withAttachments.prompt') },
    ],
    [t],
  );
  return (
    <AgentAvatarProvider>
      <View className="flex-1">
        <AliaChatContent
          app="inbox"
          clientContext={t('inbox.aliaClientContext')}
          welcomeSuggestions={welcomeSuggestions}
        />
      </View>
    </AgentAvatarProvider>
  );
}
