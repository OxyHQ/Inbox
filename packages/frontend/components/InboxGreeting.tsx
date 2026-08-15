/**
 * The date and greeting that head the inbox: today's date as the screen
 * heading, the personalized greeting under it, and an optional collapsed AI
 * daily brief.
 *
 * Rendered as the inbox list's header rather than as its own screen — it is a
 * few lines of context above the messages, not a destination.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useOxy } from '@oxyhq/services';
import { getNormalizedUserHandle } from '@oxyhq/core';
import { SPACING as BLOOM_SPACING } from '@oxyhq/bloom/design-tokens';

import { useColors } from '@/constants/theme';
import { useDailyBrief } from '@/hooks/queries/useDailyBrief';
import { useInboxPrefs } from '@/contexts/inbox-prefs-context';
import { useTranslation } from '@/lib/i18n';
import type { Message } from '@/services/emailApi';
import { AliaFace } from '@/components/AliaFace';

function getGreetingKey(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'home.greeting.morning';
  if (hour < 18) return 'home.greeting.afternoon';
  return 'home.greeting.evening';
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
  );
}

interface InboxGreetingProps {
  messages: Message[];
  onAskAlia?: () => void;
}

export function InboxGreeting({ messages, onAskAlia }: InboxGreetingProps) {
  const colors = useColors();
  const { user } = useOxy();
  const { prefs } = useInboxPrefs();
  const { t } = useTranslation();
  const [briefExpanded, setBriefExpanded] = useState(false);

  // Refreshed on focus so the date self-heals when the day rolls over while
  // the app sits open.
  const [today, setToday] = useState(() => new Date());
  useFocusEffect(
    useCallback(() => {
      const now = new Date();
      setToday((prev) => (isSameDay(prev, now) ? prev : now));
    }, []),
  );

  const dayMessages = useMemo(
    () => messages.filter((m) => isSameDay(new Date(m.date), today)),
    [messages, today],
  );

  const { briefText, isStreaming, isLoading, error, regenerate } = useDailyBrief(dayMessages, {
    enabled: prefs.aiBrief && briefExpanded,
    autoGenerate: true,
  });

  const dateLabel = useMemo(
    () => today.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }),
    [today],
  );

  const greetingName = user?.name?.displayName ?? getNormalizedUserHandle(user) ?? '';
  const greetingLine = greetingName
    ? t('home.greeting.withName', { greeting: t(getGreetingKey()), name: greetingName })
    : t(getGreetingKey());

  /**
   * The brief line always says something once the user expands it. Streaming text wins as soon as there
   * is any; otherwise every state — generating, failed, nothing to summarize —
   * has its own copy, so the line is never blank.
   */
  const briefLine = useMemo(() => {
    if (briefText) return briefText;
    if (isLoading || isStreaming) return t('home.brief.writing');
    if (error) return t('home.brief.failed');
    if (dayMessages.length === 0) return t('home.brief.nothingNew');
    return t('home.brief.preparing');
  }, [briefText, isLoading, isStreaming, error, dayMessages.length, t]);

  return (
    <View style={styles.container}>
      <Text style={[styles.date, { color: colors.unread }]}>{dateLabel}</Text>
      <Text style={[styles.greeting, { color: colors.unread }]}>{greetingLine}</Text>

      {prefs.aiBrief ? (
        <View style={[styles.briefCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Pressable
            onPress={() => setBriefExpanded((expanded) => !expanded)}
            accessibilityRole="button"
            accessibilityLabel={t('home.todaysBrief')}
            accessibilityHint={briefExpanded ? t('common.less') : t('common.more')}
            accessibilityState={{ expanded: briefExpanded }}
            style={styles.briefTrigger}
          >
            <Text style={[styles.briefTitle, { color: colors.unread }]}>{t('home.todaysBrief')}</Text>
            <Text style={[styles.briefToggle, { color: colors.secondaryText }]}>
              {briefExpanded ? t('common.less') : t('common.more')}
            </Text>
          </Pressable>

          {briefExpanded ? (
            error ? (
              <Pressable
                onPress={regenerate}
                accessibilityRole="button"
                accessibilityLabel={t('home.regenerateBrief')}
              >
                <Text style={[styles.briefText, { color: colors.secondaryText }]}>
                  {briefLine} {t('home.brief.tapRetry')}
                </Text>
              </Pressable>
            ) : (
              <Text style={[styles.briefText, { color: colors.secondaryText }]}>{briefLine}</Text>
            )
          ) : null}
        </View>
      ) : null}

      {onAskAlia ? (
        <Pressable
          onPress={onAskAlia}
          accessibilityRole="button"
          accessibilityLabel={t('inbox.askAlia')}
          accessibilityHint={t('inbox.askAliaHint')}
          style={[styles.aliaAction, { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          <AliaFace size={32} expression="Idle A" />
          <Text style={[styles.aliaActionText, { color: colors.unread }]}>{t('inbox.askAlia')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: BLOOM_SPACING['space-16'],
    // Same inset above and below the block.
    paddingVertical: BLOOM_SPACING['space-16'],
    gap: BLOOM_SPACING['space-8'],
  },
  date: {
    // A small label above the greeting, which is the block's real headline.
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '400',
    lineHeight: 30,
  },
  briefText: {
    fontSize: 15,
    lineHeight: 21,
  },
  briefCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: BLOOM_SPACING['space-12'],
    paddingVertical: BLOOM_SPACING['space-8'],
    gap: BLOOM_SPACING['space-8'],
  },
  briefTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
  },
  briefTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  briefToggle: {
    fontSize: 13,
    fontWeight: '500',
  },
  aliaAction: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    paddingHorizontal: BLOOM_SPACING['space-8'],
    paddingVertical: BLOOM_SPACING['space-4'],
    gap: BLOOM_SPACING['space-4'],
  },
  aliaActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
