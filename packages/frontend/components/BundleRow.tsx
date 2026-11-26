import { Badge } from '@oxy.so/bloom/badge';
/**
 * Collapsible bundle row for the inbox list.
 *
 * Shows bundle name, icon, unread count, and latest message preview.
 * Taps to expand inline, showing bundled messages.
 */

import type { Bundle, Message } from '@/services/emailApi';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@oxy.so/bloom/typography';
import { useMemo, type ComponentProps } from 'react';
import { View, type ViewStyle } from 'react-native';
import { ListItem } from '@oxy.so/bloom/list';
import { RiArrowUpSLine } from '@oxy.so/bloom/icons/RiArrowUpSLine';
import { RiArrowDownSLine } from '@oxy.so/bloom/icons/RiArrowDownSLine';
import { useTranslation } from '@/lib/i18n';

type MaterialCommunityIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

interface BundleRowProps {
  bundle: Bundle;
  messages: Message[];
  unreadCount: number;
  isExpanded: boolean;
  onToggle: () => void;
}

export function BundleRow({ bundle, messages, unreadCount, isExpanded, onToggle }: BundleRowProps) {
  const { t } = useTranslation();
  const latestPreview = useMemo(() => {
    if (messages.length === 0) return '';
    const latest = messages[0];
    const sender = latest.from.name || latest.from.address.split('@')[0];
    const subj = latest.subject || t('message.detail.noSubject');
    return `${sender}: ${subj}`;
  }, [messages, t]);

  return (
    <ListItem
      title={bundle.name}
      supporting={isExpanded ? undefined : latestPreview}
      leading={
        <MaterialCommunityIcons
          name={(bundle.icon || 'folder-outline') as MaterialCommunityIconName}
          size={20}
          color={bundle.color}
        />
      }
      trailing={
        <View style={trailingStyle}>
          {unreadCount > 0 && (
            <Badge color="primary" variant="subtle" content={unreadCount} size="sm" />
          )}
          <Text variant="caption-1-regular">{messages.length}</Text>
          {isExpanded ? <RiArrowUpSLine /> : <RiArrowDownSLine />}
        </View>
      }
      onPress={onToggle}
      label={t(isExpanded ? 'bundles.rowExpanded' : 'bundles.rowCollapsed', {
        name: bundle.name,
        count: messages.length,
      })}
    />
  );
}

const trailingStyle: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: 8 };
