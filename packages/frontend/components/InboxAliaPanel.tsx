import { GemieChatContent } from '@gemies/sdk';
import { AgentAvatarProvider } from '@oxy.so/bloom/agent-avatar';
import { useMemo } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Embed, VStack, toElement } from '@oxy.so/bloom-language';

/** Alia's own conversation screen (the SDK's `GemieChatContent`), where no message is open. */
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
      {toElement(
        VStack(
          Embed(
            <GemieChatContent
              app="inbox"
              clientContext={t('inbox.aliaClientContext')}
              welcomeSuggestions={welcomeSuggestions}
            />,
          ),
        ).flex('1'),
      )}
    </AgentAvatarProvider>
  );
}
