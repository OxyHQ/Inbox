/**
 * Importance Badge component.
 *
 * Visual indicator for email importance/urgency.
 * Shows different badges: urgent, important, action needed, etc.
 */

import React, { useMemo } from 'react';
import { Chip } from '@oxy.so/bloom/chip';
import { Badge } from '@oxy.so/bloom/badge';

import { useInboxPrefs } from '@/contexts/inbox-prefs-context';
import type { Message } from '@/services/emailApi';
import { useTranslation } from '@/lib/i18n';

export type ImportanceLevel = 'urgent' | 'action' | 'important' | 'fyi' | null;

// Patterns to detect importance
const URGENT_PATTERNS = [
  /urgent/i,
  /asap/i,
  /immediately/i,
  /time.?sensitive/i,
  /deadline.?(today|tomorrow)/i,
  /need.{0,10}now/i,
];

const ACTION_PATTERNS = [
  /action.?required/i,
  /please.{0,15}(sign|approve|review|confirm)/i,
  /waiting for (your|a) (response|reply|approval)/i,
  /needs? your (attention|approval|signature)/i,
  /by (end of day|eod|cob|tomorrow|friday)/i,
];

const IMPORTANT_PATTERNS = [/important/i, /priority/i, /critical/i, /\[important\]/i];

export function detectImportance(message: Message): ImportanceLevel {
  const subject = message.subject || '';
  const text = (message.text || '').slice(0, 1000);
  const combined = `${subject} ${text}`;

  // Check urgent first (highest priority)
  if (URGENT_PATTERNS.some((p) => p.test(combined))) {
    return 'urgent';
  }

  // Then action required
  if (ACTION_PATTERNS.some((p) => p.test(combined))) {
    return 'action';
  }

  // Then general importance
  if (IMPORTANT_PATTERNS.some((p) => p.test(combined))) {
    return 'important';
  }

  return null;
}

interface ImportanceBadgeProps {
  message: Message;
  onPress?: () => void;
}

const BADGE_CONFIG: Record<
  Exclude<ImportanceLevel, null>,
  {
    /** `importance.<level>` */
    labelKey: string;
    color: 'error' | 'warning' | 'primary' | 'default';
  }
> = {
  urgent: {
    labelKey: 'importance.urgent',
    color: 'error',
  },
  action: {
    labelKey: 'importance.action',
    color: 'warning',
  },
  important: {
    labelKey: 'importance.important',
    color: 'primary',
  },
  fyi: {
    labelKey: 'importance.fyi',
    color: 'default',
  },
};

export function ImportanceBadge({ message, onPress }: ImportanceBadgeProps) {
  const { t } = useTranslation();
  const { prefs } = useInboxPrefs();
  const importance = useMemo(() => detectImportance(message), [message]);

  // Categorization is an AI convenience; respect the user's opt-out.
  if (!prefs.aiCategorization || !importance) {
    return null;
  }

  const config = BADGE_CONFIG[importance];

  const badge = (
    <Badge variant="subtle" color={config.color} content={t(config.labelKey)} size="small" />
  );

  if (onPress) {
    return (
      <Chip onPress={onPress} color={config.color} variant="subtle">
        {t(config.labelKey)}
      </Chip>
    );
  }

  return badge;
}
