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
import { View } from 'react-native';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@oxy.so/bloom/card';
import { RiArrowUpSLine, RiArrowDownSLine } from '@oxy.so/bloom/icons';

type MaterialCommunityIconName = ComponentProps<
  typeof MaterialCommunityIcons
>['name'];

interface BundleRowProps {
  bundle: Bundle;
  messages: Message[];
  unreadCount: number;
  isExpanded: boolean;
  onToggle: () => void;
}

export function BundleRow({
  bundle,
  messages,
  unreadCount,
  isExpanded,
  onToggle,
}: BundleRowProps) {
  const latestPreview = useMemo(() => {
    if (messages.length === 0) return '';
    const latest = messages[0];
    const sender = latest.from.name || latest.from.address.split('@')[0];
    const subj = latest.subject || '(no subject)';
    return `${sender}: ${subj}`;
  }, [messages]);

  return (
    <Card
      appearance="plain"
      onPress={onToggle}
      accessibilityLabel={`${bundle.name}, ${messages.length} messages, ${isExpanded ? 'collapse' : 'expand'}`}
    >
      <CardHeader>
        <View className="flex-row items-center gap-2">
          <MaterialCommunityIcons
            name={
              (bundle.icon || 'folder-outline') as MaterialCommunityIconName
            }
            size={20}
            color={bundle.color}
          />
          <View className="flex-1">
            <CardTitle>{bundle.name}</CardTitle>
          </View>
          {unreadCount > 0 && (
            <Badge
              color="primary"
              variant="subtle"
              content={unreadCount}
              size="small"
            />
          )}
          <Text variant="caption-1-regular">{messages.length}</Text>
          {isExpanded ? <RiArrowUpSLine /> : <RiArrowDownSLine />}
        </View>
        {!isExpanded && (
          <CardDescription numberOfLines={1}>{latestPreview}</CardDescription>
        )}
      </CardHeader>
    </Card>
  );
}
