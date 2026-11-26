import { Button } from '@oxy.so/bloom/button';
import { CardBody } from '@oxy.so/bloom/card';
import { ListItem } from '@oxy.so/bloom/list';
import { Text } from '@oxy.so/bloom/typography';
import type { ReactNode } from 'react';
import { useMessage } from '@/hooks/queries/useMessage';
import type { Message } from '@/services/emailApi';
import type { InboxDailyBrief } from '@/services/inboxInferenceApi';
import type { ViewStyle } from 'react-native';

import { useInboxPrefs } from '@/contexts/inbox-prefs-context';
import { useDailyBrief } from '@/hooks/queries/useDailyBrief';
import { useTranslation } from '@/lib/i18n';
import type { InboxDailyBriefAction } from '@/services/inboxInferenceApi';
import { formatRowTime } from '@/utils/dateFormat';

import { Embed, HStack, VStack, toElement } from '@oxy.so/bloom-language';
import { Card as LCard } from '@oxy.so/bloom-language/containers';

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
  const { brief, isLoading, error, regenerate, markOpened, canAct, actionsReady } = useDailyBrief({
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

  return toElement(
    VStack(
      LCard(
        Embed(
          (status || summary || !actionsReady) && (
            <CardBody>
              {(status || summary) && (
                <Text
                  variant={status ? 'body-regular' : 'title-3-regular'}
                  accessibilityLiveRegion="polite"
                >
                  {status ?? summary}
                </Text>
              )}
              {!actionsReady && (
                <Text accessibilityLiveRegion="polite">{t('home.brief.sessionUnavailable')}</Text>
              )}
              {!error &&
                brief?.actions &&
                toElement(
                  HStack(
                    Embed(
                      brief.actions.map((action) => (
                        <Button
                          key={action.label}
                          appearance="subtle"
                          size="sm"
                          disabled={!actionsReady}
                          onPress={() => {
                            if (canAct()) onAction(action);
                          }}
                        >
                          {action.label}
                        </Button>
                      )),
                    ),
                  )
                    .padding('top', 'md')
                    .wrap()
                    .spacing('sm'),
                )}
              {error && (
                <Button
                  appearance="subtle"
                  style={RETRY_STYLE}
                  disabled={!actionsReady}
                  onPress={() => void regenerate()}
                >
                  {t('common.retry')}
                </Button>
              )}
            </CardBody>
          ),
        ),
        Embed(
          !error &&
            brief?.items.map((item) => (
              <BriefMessageRow
                key={item.messageId}
                item={item}
                message={messages.find((message) => message._id === item.messageId)}
                renderMessage={renderMessage}
                actionsReady={actionsReady}
                onOpen={() => {
                  if (!canAct()) return;
                  markOpened(item.messageId);
                  if (canAct()) onOpenMessage(item.messageId);
                }}
              />
            )),
        ),
      ),
    )
      .padding('horizontal', 'md')
      .padding('bottom', 'md'),
  );
}

/** The generated note is cached, while labels, flags and files come from live mail queries. */
function BriefMessageRow({
  item,
  message,
  renderMessage,
  actionsReady,
  onOpen,
}: {
  item: InboxDailyBrief['items'][number];
  message?: Message;
  renderMessage?: (message: Message, note: string, onOpen: () => void) => ReactNode;
  actionsReady: boolean;
  onOpen: () => void;
}) {
  const { data } = useMessage(message ? undefined : item.messageId);
  const { t, locale } = useTranslation();
  const current = message ?? data;
  if (current && renderMessage && actionsReady) return renderMessage(current, item.note, onOpen);
  return (
    <ListItem
      mail={{
        sender: { name: item.from.name || item.from.address },
        subject: item.subject || t('message.detail.noSubject'),
        snippet: item.note || undefined,
        time: formatRowTime(item.receivedAt, t('inbox.sections.yesterday'), locale),
        unread: item.unread,
        hasAttachment: item.hasAttachments,
        strings: {
          attachment: t('search.filters.hasAttachment'),
          unread: t('message.unreadState'),
        },
      }}
      swipeEnabled={false}
      onPress={actionsReady ? onOpen : undefined}
    />
  );
}

const RETRY_STYLE: ViewStyle = { alignSelf: 'flex-start' };
