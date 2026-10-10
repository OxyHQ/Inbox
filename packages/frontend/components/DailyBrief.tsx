import { Button } from '@oxy.so/bloom/button';
import { Card, CardBody } from '@oxy.so/bloom/card';
import { MailRow } from '@oxy.so/bloom/mail-list';
import { Text } from '@oxy.so/bloom/typography';
/**
 * Today's Brief, mounted only when the reader opens it.
 *
 * A short summary, then the messages it names as real mail rows — grouped by
 * what they need — with the brief's one-line note where the snippet would be.
 * A row opens its message like any row in the list.
 */

import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { SPACING } from '@/constants/layout';
import { useColors } from '@/constants/theme';
import { useInboxPrefs } from '@/contexts/inbox-prefs-context';
import { useDailyBrief } from '@/hooks/queries/useDailyBrief';
import { useTranslation } from '@/lib/i18n';
import {
  INBOX_DAILY_BRIEF_SECTIONS,
  type InboxDailyBriefItem,
} from '@/services/inboxInferenceApi';
import { formatRowTime } from '@/utils/dateFormat';

const SECTION_TITLE = {
  needs_you: 'home.brief.sections.needsYou',
  today: 'home.brief.sections.today',
  earlier: 'home.brief.sections.earlier',
} as const;

export function DailyBrief({ onOpenMessage }: { onOpenMessage: (messageId: string) => void }) {
  const { prefs } = useInboxPrefs();
  const { t, locale } = useTranslation();
  const colors = useColors();
  const { brief, isLoading, error, regenerate, markOpened } = useDailyBrief({
    enabled: prefs.aiBrief,
  });

  const sections = useMemo(
    () =>
      INBOX_DAILY_BRIEF_SECTIONS.map((section) => ({
        section,
        items: (brief?.items ?? []).filter((item) => item.section === section),
      })).filter(({ items }) => items.length > 0),
    [brief],
  );

  const status = error
    ? t('home.brief.failed')
    : isLoading
      ? t('home.brief.writing')
      : brief && !brief.summary && brief.items.length === 0
        ? t('home.brief.nothingNew')
        : null;

  const open = (item: InboxDailyBriefItem) => {
    markOpened(item.messageId);
    onOpenMessage(item.messageId);
  };

  return (
    <View className="px-3 pb-3">
      <Card>
        <CardBody>
          <Text accessibilityLiveRegion="polite">{status ?? brief?.summary}</Text>
          {error && (
            <Button appearance="subtle" onPress={() => void regenerate()}>
              {t('common.retry')}
            </Button>
          )}
        </CardBody>
        {!error &&
          sections.map(({ section, items }) => (
            <View key={section}>
              <View style={styles.sectionHeader} accessibilityRole="header">
                <Text style={[styles.sectionHeaderText, { color: colors.secondaryText }]}>
                  {t(SECTION_TITLE[section])}
                </Text>
              </View>
              {items.map((item) => (
                <MailRow
                  key={item.messageId}
                  sender={{ name: item.from.name || item.from.address }}
                  subject={item.subject || t('message.detail.noSubject')}
                  snippet={item.note || undefined}
                  time={formatRowTime(item.receivedAt, t('inbox.sections.yesterday'), locale)}
                  unread={item.unread}
                  hasAttachment={item.hasAttachments}
                  swipeEnabled={false}
                  onPress={() => open(item)}
                  strings={{
                    attachment: t('search.filters.hasAttachment'),
                    unread: t('message.unreadState'),
                  }}
                />
              ))}
            </View>
          ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
