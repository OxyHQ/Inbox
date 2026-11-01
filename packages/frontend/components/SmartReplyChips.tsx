/**
 * Smart Reply Chips component.
 *
 * Displays AI-generated quick reply suggestions as tappable chips.
 * Tapping a chip inserts the text into the reply composer.
 */

import { Button } from '@oxy.so/bloom/button';
import { Chip } from '@oxy.so/bloom/chip';
import { RiSparklingLine } from '@oxy.so/bloom/icons/RiSparklingLine';
import { Loading } from '@oxy.so/bloom/loading';
import { Text } from '@oxy.so/bloom/typography';
import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { onlineManager } from '@tanstack/react-query';
import { View } from 'react-native';

import { useInboxPrefs } from '@/contexts/inbox-prefs-context';
import { useSmartReplies } from '@/hooks/queries/useSmartReplies';
import { type SmartReplyOwner, useSmartReplyOwner } from '@/hooks/queries/useSmartReplyOwner';
import type { Message } from '@/services/emailApi';
import { useTranslation } from '@/lib/i18n';

interface SmartReplyChipsProps {
  message: Message;
  onSelectReply: (text: string) => void;
}

export function SmartReplyChips(props: SmartReplyChipsProps) {
  const owner = useSmartReplyOwner();
  const scope = JSON.stringify([
    props.message._id,
    owner.binding,
    owner.subject,
    owner.sessionId,
    owner.revision,
    owner.epoch,
    owner.knownSubject,
    owner.authenticated,
  ]);
  return <MessageSmartReplyChips key={scope} {...props} owner={owner} />;
}

function MessageSmartReplyChips({
  message,
  onSelectReply,
  owner,
}: SmartReplyChipsProps & { owner: SmartReplyOwner }) {
  const { t } = useTranslation();
  const { prefs } = useInboxPrefs();
  const [hasRequestedReplies, setHasRequestedReplies] = useState(false);
  const { replies, isLoading, isPending, isPaused, error, refetch } = useSmartReplies(
    message,
    owner,
  );
  const online = useSyncExternalStore(
    onlineManager.subscribe,
    () => onlineManager.isOnline(),
    () => onlineManager.isOnline(),
  );
  const mountedRef = useRef(false);
  const requestedRef = useRef(false);
  const inFlightRef = useRef(false);

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleGenerateReplies = useCallback(() => {
    if (
      !mountedRef.current ||
      !owner.isCurrent() ||
      inFlightRef.current ||
      (requestedRef.current && !onlineManager.isOnline())
    )
      return;
    requestedRef.current = true;
    inFlightRef.current = true;
    setHasRequestedReplies(true);
    void refetch()
      .catch(() => undefined)
      .finally(() => {
        inFlightRef.current = false;
      });
  }, [refetch, owner]);

  // Smart Reply is opt-in; render nothing when the user disabled it.
  if (!prefs.aiSmartReply) {
    return null;
  }

  if (!hasRequestedReplies) {
    return (
      <View className="gap-2">
        <Button
          appearance="subtle"
          leading={<RiSparklingLine />}
          onPress={handleGenerateReplies}
          disabled={!owner.ready}
        >
          {t('smartReply.generate')}
        </Button>
        <Text variant="caption-1-regular">{t('smartReply.notice')}</Text>
        {!owner.ready && <Text variant="caption-1-regular">{t('smartReply.unavailable')}</Text>}
      </View>
    );
  }
  const generating = isLoading || (isPending && !isPaused);
  if (!generating && replies.length === 0) {
    const showFailure = error !== null || isPaused;
    const status = !showFailure
      ? t('smartReply.empty')
      : !online
        ? t('smartReply.offline')
        : isPaused
          ? t('smartReply.waiting')
          : t('smartReply.failed');
    return (
      <View className="gap-2">
        <Text variant="caption-1-regular" accessibilityLiveRegion="polite">
          {status}
        </Text>
        {showFailure && (
          <>
            <Button
              appearance="subtle"
              onPress={handleGenerateReplies}
              disabled={!online || isPaused || !owner.ready}
            >
              {t('common.retry')}
            </Button>
            <Text variant="caption-1-regular">{t('smartReply.notice')}</Text>
          </>
        )}
      </View>
    );
  }
  return (
    <View className="gap-2">
      <Text variant="caption-1-regular">{t('smartReply.quickReplies')}</Text>
      <View className="flex-row flex-wrap gap-2">
        {generating ? (
          <Loading text={t('smartReply.generating')} />
        ) : (
          replies.map((reply, index) => (
            <Chip
              // biome-ignore lint/suspicious/noArrayIndexKey: stateless chips, replaced as a whole on each generation; two replies can be the same text.
              key={index}
              appearance="subtle"
              tone="accent"
              onPress={() => {
                if (mountedRef.current && owner.isCurrent()) onSelectReply(reply);
              }}
            >
              {reply}
            </Chip>
          ))
        )}
      </View>
    </View>
  );
}
