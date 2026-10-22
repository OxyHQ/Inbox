import { AliaChatSheet, type AliaChatSheetRef } from '@alia.onl/sdk';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from '@/lib/i18n';
import type { InboxDailyBriefAction } from '@/services/inboxInferenceApi';

export interface InboxAliaRequest {
  action?: InboxDailyBriefAction;
}

/** Loaded on first use; each request opens Alia after its context has committed. */
export default function InboxAlia({ request }: { request: InboxAliaRequest }) {
  const { t } = useTranslation();
  const sheet = useRef<AliaChatSheetRef>(null);
  const presented = useRef<InboxAliaRequest | null>(null);
  const welcomeSuggestions = useMemo(
    () => [
      { id: 'unread', text: t('inbox.aliaSuggestions.unread.prompt') },
      { id: 'today-summary', text: t('inbox.aliaSuggestions.todaysSummary.prompt') },
      { id: 'with-attachments', text: t('inbox.aliaSuggestions.withAttachments.prompt') },
    ],
    [t],
  );
  useEffect(() => {
    if (!sheet.current || presented.current === request) return;
    presented.current = request;
    sheet.current.present(request.action ? { text: request.action.prompt } : undefined);
  }, [request]);

  return (
    <AliaChatSheet
      ref={sheet}
      app="inbox"
      clientContext={
        request.action
          ? `${t('inbox.aliaClientContext')}\nThe selected daily brief action refers to these Inbox message IDs: ${JSON.stringify(request.action.messageIds)}. Read their current contents with Inbox tools before acting.`
          : t('inbox.aliaClientContext')
      }
      welcomeSuggestions={welcomeSuggestions}
    />
  );
}
