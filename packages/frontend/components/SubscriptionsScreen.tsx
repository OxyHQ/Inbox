import { VirtualList, type VirtualListHandle } from '@oxy.so/bloom/list';
import { PageHeader } from '@oxy.so/bloom/page-header';
import { Screen } from '@oxy.so/bloom/screen';
import { useScrollRestoration } from '@oxy.so/bloom/scroll';
import { useOxy } from '@oxy.so/services/ui/client';
/**
 * Subscriptions management screen.
 *
 * Lists newsletter/mailing-list senders with unsubscribe actions,
 * similar to Gmail's "Manage subscriptions" feature.
 */

import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { SubscriptionRow } from '@/components/SubscriptionRow';
import { SubscriptionStacks } from '@/components/SubscriptionStacks';
import { useUnsubscribe } from '@/hooks/mutations/useUnsubscribe';
import { useSubscriptions } from '@/hooks/queries/useSubscriptions';
import { useGoBack } from '@/hooks/useGoBack';
import type { Subscription } from '@/services/emailApi';
import { useAppShell } from '@oxy.so/bloom/app-shell';
import { ButtonGroup, ButtonGroupItem } from '@oxy.so/bloom/button-group';
import { Divider } from '@oxy.so/bloom/divider';
import { EmptyState } from '@oxy.so/bloom/empty-state';
import { EmptyStateSticker } from '@/components/EmptyStateSticker';
import { RiMenuLine } from '@oxy.so/bloom/icons/RiMenuLine';
import { Loading } from '@oxy.so/bloom/loading';
import { Text } from '@oxy.so/bloom/typography';
import { useTranslation } from '@/lib/i18n';

export function SubscriptionsScreen() {
  const shell = useAppShell();
  const focused = useIsFocused();
  const { t } = useTranslation();
  const { user, oxyServices } = useOxy();

  const { data, isLoading, isRefetching, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useSubscriptions();

  // `onRefresh` resolves to nothing, and `refetch` resolves to the query result.
  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const unsubscribeMutation = useUnsubscribe();
  const pending = useRef(new Map<string, symbol>());
  const mounted = useRef(false);
  const [pendingKeys, setPendingKeys] = useState<ReadonlySet<string>>(() => new Set());
  const scope = JSON.stringify([user?.id ?? null, oxyServices.http.getSessionEpoch()]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Offset pagination over a live aggregate: a message arriving between two
  // page fetches shifts every sender's rank, so a sender already on screen can
  // come back in the next page. Keeping the first occurrence preserves the
  // server's order — the row is identified by its sender address, so the
  // duplicate carries nothing new.
  const subscriptions = useMemo(() => {
    const seen = new Set<string>();
    const merged: Subscription[] = [];
    for (const page of data?.pages ?? []) {
      for (const sub of page.data) {
        if (seen.has(sub._id)) continue;
        seen.add(sub._id);
        merged.push(sub);
      }
    }
    return merged;
  }, [data]);
  // The piles are for deciding what to keep; a sender already unsubscribed
  // from is decided, and stays only in the list below, marked as such.
  const activeSubscriptions = useMemo(
    () => subscriptions.filter((sub) => !sub.unsubscribed),
    [subscriptions],
  );

  const handleBack = useGoBack();

  const handleUnsubscribe = useCallback(
    (senderAddress: string, method?: 'list-unsubscribe' | 'block') => {
      const key = JSON.stringify([scope, senderAddress]);
      if (pending.current.has(key)) return;
      const operation = Symbol();
      pending.current.set(key, operation);
      setPendingKeys(new Set(pending.current.keys()));
      void unsubscribeMutation
        .mutateAsync({ senderAddress, method })
        .catch(() => {})
        .finally(() => {
          if (pending.current.get(key) !== operation) return;
          pending.current.delete(key);
          if (mounted.current) setPendingKeys(new Set(pending.current.keys()));
        });
    },
    [unsubscribeMutation, scope],
  );

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  /**
   * Tapping a pile scrolls the list to that sender — the pile is a jump target,
   * matching the header's "Scroll to <sender>" affordance.
   */
  const listRef = useRef<VirtualListHandle>(null);
  const restoration = useScrollRestoration(listRef, {
    key: JSON.stringify(['subscriptions', user?.id]),
    enabled: focused && subscriptions.length > 0,
  });
  const handleSelectSubscription = useCallback(
    (subscriptionId: string) => {
      const index = subscriptions.findIndex((s) => s._id === subscriptionId);
      if (index < 0) return;
      listRef.current?.scrollToOffset({ offset: SUBSCRIPTION_ROW_HEIGHT * index });
    },
    [subscriptions],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Subscription; index: number }) => (
      <>
        <SubscriptionRow
          subscription={item}
          onUnsubscribe={handleUnsubscribe}
          isUnsubscribing={pendingKeys.has(JSON.stringify([scope, item._id]))}
        />
        {index < subscriptions.length - 1 && <Divider spacing={0} />}
      </>
    ),
    [handleUnsubscribe, scope, pendingKeys, subscriptions.length],
  );

  const renderEmpty = useCallback(
    () => (
      <EmptyState
        illustration={<EmptyStateSticker name="subscriptions" />}
        title={t('subscriptions.empty.title')}
        description={t('subscriptions.empty.subtitle')}
      />
    ),
    [t],
  );
  const renderFooter = useCallback(
    () => (isFetchingNextPage ? <Loading /> : null),
    [isFetchingNextPage],
  );

  return (
    <Screen
      active={focused}
      scroll="auto"
      header={
        <PageHeader
          title={t('drawer.subscriptions')}
          onBack={handleBack}
          sticky={false}
          scrim="auto"
          testID="subscriptions-header"
          safeArea={false}
          leading={
            shell.drawerAvailable ? (
              <ButtonGroup accessibilityLabel={t('search.openMenu')}>
                <ButtonGroupItem
                  iconOnly
                  leadingIcon={RiMenuLine}
                  accessibilityLabel={t('search.openMenu')}
                  onPress={shell.openDrawer}
                />
              </ButtonGroup>
            ) : undefined
          }
        />
      }
    >
      {isLoading ? (
        <View className="flex-1 justify-center">
          <Loading />
        </View>
      ) : (
        <VirtualList
          testID="subscriptions-list"
          ref={listRef}
          screen={{ active: focused, restoration }}
          data={subscriptions}
          renderItem={renderItem}
          keyExtractor={subscriptionKey}
          ListHeaderComponent={
            <>
              <SubscriptionStacks
                subscriptions={activeSubscriptions}
                onSelect={handleSelectSubscription}
              />
              {/* Scrolls with the list rather than sitting in a fixed band:
                  only the header stays put, same as the inbox. */}
              {subscriptions.length > 0 && (
                <View className="px-4 py-3">
                  <Text variant="caption-1-regular">{t('subscriptions.delayNotice')}</Text>
                </View>
              )}
            </>
          }
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          refreshing={isRefetching && !isFetchingNextPage}
          onRefresh={handleRefresh}
          contentContainerStyle={subscriptions.length === 0 ? { flexGrow: 1 } : undefined}
        />
      )}
    </Screen>
  );
}

/** Where the list jumps to for a sender: rows are one height, so the offset is the index times it. */
const SUBSCRIPTION_ROW_HEIGHT = 72;
const subscriptionKey = (subscription: Subscription) => subscription._id;
