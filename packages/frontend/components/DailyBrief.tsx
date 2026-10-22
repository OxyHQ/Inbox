import { Button } from '@oxy.so/bloom/button';
import { Card, CardBody } from '@oxy.so/bloom/card';
import { MailRow } from '@oxy.so/bloom/mail-list';
import { Text } from '@oxy.so/bloom/typography';
import type { ReactNode } from 'react';
import { useMessage } from '@/hooks/queries/useMessage';
import type { Message } from '@/services/emailApi';
import type { InboxDailyBrief } from '@/services/inboxInferenceApi';
import { View } from 'react-native';

import { useInboxPrefs } from '@/contexts/inbox-prefs-context';
import { useDailyBrief } from '@/hooks/queries/useDailyBrief';
import { useTranslation } from '@/lib/i18n';
import type { InboxDailyBriefAction } from '@/services/inboxInferenceApi';
import { formatRowTime } from '@/utils/dateFormat';

/** A summary and its messages in one card, without extra section headings. */
export function DailyBrief({
  onOpenMessage,
  onAction,
  messages = [],
  renderMessage,
}: {
  onOpenMessage: (messageId: string) => void;
  onAction: (action: InboxDailyBriefAction) => void;
  messages?: Message[];
  renderMessage?: (message: Message, note: string, onOpen: () => void) => ReactNode;
}) {
  const { prefs } = useInboxPrefs();
  const { t } = useTranslation();
  const { brief, isLoading, error, regenerate, markOpened } = useDailyBrief({
    enabled: prefs.aiBrief,
  });

  const status = error
    ? t('home.brief.failed')
    : isLoading
      ? t('home.brief.writing')
      : brief && !brief.summary && brief.items.length === 0
        ? t('home.brief.nothingNew')
        : null;
  const summary = brief?.summary.trim();

  if (!status && !summary && !brief?.items.length) return null;

  return (
    <View className="px-3 pb-3">
      <Card>
        {(status || summary) && (
          <CardBody>
            <Text
              variant={status ? 'body-regular' : 'title-3-regular'}
              accessibilityLiveRegion="polite"
            >
              {status ?? summary}
            </Text>
            {!error && brief?.actions && (
              <View className="flex-row flex-wrap gap-2 pt-3">
                {brief.actions.map((action) => (
                  <Button
                    key={action.label}
                    appearance="subtle"
                    size="sm"
                    onPress={() => onAction(action)}
                  >
                    {action.label}
                  </Button>
                ))}
              </View>
            )}
            {error && (
              <Button appearance="subtle" className="self-start" onPress={() => void regenerate()}>
                {t('common.retry')}
              </Button>
            )}
          </CardBody>
        )}
        {!error &&
          brief?.items.map((item) => (
            <BriefMessageRow
              key={item.messageId}
              item={item}
              message={messages.find((message) => message._id === item.messageId)}
              renderMessage={renderMessage}
              onOpen={() => {
                markOpened(item.messageId);
                onOpenMessage(item.messageId);
              }}
            />
          ))}
      </Card>
    </View>
  );
}

/** The generated note is cached, while labels, flags and files come from live mail queries. */
function BriefMessageRow({
  item,
  message,
  renderMessage,
  onOpen,
}: {
  item: InboxDailyBrief['items'][number];
  message?: Message;
  renderMessage?: (message: Message, note: string, onOpen: () => void) => ReactNode;
  onOpen: () => void;
}) {
  const { data } = useMessage(message ? undefined : item.messageId);
  const { t, locale } = useTranslation();
  const current = message ?? data;
  if (current && renderMessage) return renderMessage(current, item.note, onOpen);
  return (
    <MailRow
      sender={{ name: item.from.name || item.from.address }}
      subject={item.subject || t('message.detail.noSubject')}
      snippet={item.note || undefined}
      time={formatRowTime(item.receivedAt, t('inbox.sections.yesterday'), locale)}
      unread={item.unread}
      hasAttachment={item.hasAttachments}
      swipeEnabled={false}
      onPress={onOpen}
      strings={{ attachment: t('search.filters.hasAttachment'), unread: t('message.unreadState') }}
    />
  );
}
