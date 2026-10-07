import { BREAKPOINTS } from '@oxy.so/bloom/styles';
import {
  ScrollMetricsProvider,
  TopEdgeProvider,
  useBottomEdgeInset,
  useAnimatedScrollMetricsBinding,
  useTopEdgeInset,
} from '@oxy.so/bloom/layout';
import { PageHeader } from '@oxy.so/bloom/page-header';
import { ScrollRestorationProvider, useScrollRestoration } from '@oxy.so/bloom/scroll';
import { expoRouterScrollAdapter } from '@oxy.so/bloom/scroll/expo-router';
import { useOxy } from '@oxy.so/services';
/**
 * Subscriptions management screen.
 *
 * Lists newsletter/mailing-list senders with unsubscribe actions,
 * similar to Gmail's "Manage subscriptions" feature.
 */

import { useMinimizeOnScroll } from '@oxy.so/bloom/tab-bar';
import {
  FlashList,
  type FlashListProps,
  type FlashListRef,
} from '@shopify/flash-list';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useWindowDimensions, RefreshControl, View } from 'react-native';
import Animated, { type AnimatedProps } from 'react-native-reanimated';

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
import { RiMenuLine } from '@oxy.so/bloom/icons';
import { Loading } from '@oxy.so/bloom/loading';
import { Text } from '@oxy.so/bloom/typography';
import { useTranslation } from '@/lib/i18n';

const AnimatedSubscriptionsList = Animated.createAnimatedComponent(
  FlashList as React.ComponentType<FlashListProps<Subscription>>,
) as React.ComponentType<
  AnimatedProps<FlashListProps<Subscription>> & {
    ref?: React.Ref<FlashListRef<Subscription>>;
  }
>;

export function SubscriptionsScreen() {
  return (
    <ScrollRestorationProvider adapter={expoRouterScrollAdapter}>
      <TopEdgeProvider>
        <ScrollMetricsProvider>
          <SubscriptionsContent />
        </ScrollMetricsProvider>
      </TopEdgeProvider>
    </ScrollRestorationProvider>
  );
}

function SubscriptionsContent() {
  const minimizeTabBarOnScroll = useMinimizeOnScroll();
  const headerClearance = useTopEdgeInset();
  const shell = useAppShell();
  const occupiedBottom = useBottomEdgeInset();
  const { width: viewportWidth } = useWindowDimensions();
  const bottomClearance = viewportWidth < BREAKPOINTS.md ? occupiedBottom : 0;
  const { t } = useTranslation();
  const { user } = useOxy();

  const {
    data,
    isLoading,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useSubscriptions();

  const unsubscribeMutation = useUnsubscribe();
  const [unsubscribingAddress, setUnsubscribingAddress] = useState<
    string | null
  >(null);

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

  const handleBack = useGoBack();

  const handleUnsubscribe = useCallback(
    (senderAddress: string, method?: 'list-unsubscribe' | 'block') => {
      setUnsubscribingAddress(senderAddress);
      unsubscribeMutation.mutate(
        { senderAddress, method },
        { onSettled: () => setUnsubscribingAddress(null) },
      );
    },
    [unsubscribeMutation],
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
  const listRef = useRef<FlashListRef<Subscription>>(null);
  const scrollRestoration = useScrollRestoration(listRef, {
    key: JSON.stringify(['subscriptions', user?.id]),
    enabled: subscriptions.length > 0,
  });
  const scrollBinding = useAnimatedScrollMetricsBinding({
    handler: minimizeTabBarOnScroll,
    onScroll: scrollRestoration.onScroll,
  });
  const handleSelectSubscription = useCallback(
    (subscriptionId: string) => {
      const index = subscriptions.findIndex((s) => s._id === subscriptionId);
      if (index < 0) return;
      // FlashList 2 removed onScrollToIndexFailed — approximate offset first when
      // the target row may not be measured yet (e.g. after pagination).
      const estimatedRowHeight = 72;
      listRef.current?.scrollToOffset({
        offset: estimatedRowHeight * index,
        animated: false,
      });
      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0,
        });
      });
    },
    [subscriptions],
  );

  const renderItem = useCallback(
    ({ item }: { item: Subscription }) => (
      <SubscriptionRow
        subscription={item}
        onUnsubscribe={handleUnsubscribe}
        isUnsubscribing={unsubscribingAddress === item._id}
      />
    ),
    [handleUnsubscribe, unsubscribingAddress],
  );

  const renderSeparator = useCallback(() => <Divider spacing={0} />, []);
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
    <View className="flex-1">
      <PageHeader
        title={t('drawer.subscriptions')}
        onBack={handleBack}
        sticky={false}
        placement="overlay"
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
      {isLoading ? (
        <View className="flex-1 justify-center" style={{ paddingTop: headerClearance }}>
          <Loading />
        </View>
      ) : (
        <AnimatedSubscriptionsList
          testID="subscriptions-list"
          ref={listRef}
          data={subscriptions}
          renderItem={renderItem}
          ItemSeparatorComponent={renderSeparator}
          ListHeaderComponent={
            <>
              <SubscriptionStacks
                subscriptions={subscriptions}
                onSelect={handleSelectSubscription}
              />
              {/* Scrolls with the list rather than sitting in a fixed band:
                  only the header stays put, same as the inbox. */}
              {subscriptions.length > 0 && (
                <View className="px-4 py-3">
                  <Text variant="caption-1-regular">
                    When you unsubscribe, it can take a few days to stop receiving
                    messages
                  </Text>
                </View>
              )}
            </>
          }
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          {...scrollBinding}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching && !isFetchingNextPage}
              onRefresh={refetch}
            />
          }
          contentContainerStyle={{
            ...(subscriptions.length === 0 ? { flexGrow: 1 } : undefined),
            paddingTop: headerClearance,
            paddingBottom: bottomClearance,
          }}
        />
      )}
    </View>
  );
}
