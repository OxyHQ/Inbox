import { PageHeader } from '@oxy.so/bloom/page-header';
/**
 * Subscriptions management screen.
 *
 * Lists newsletter/mailing-list senders with unsubscribe actions,
 * similar to Gmail's "Manage subscriptions" feature.
 */

import React, { useMemo, useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { FlashList, type FlashListProps, type FlashListRef } from '@shopify/flash-list';
import Animated, { type AnimatedProps } from 'react-native-reanimated';
import { useMinimizeOnScroll } from '@oxy.so/bloom/tab-bar';

import { SubscriptionStacks } from '@/components/SubscriptionStacks';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  News01Icon,
} from '@hugeicons/core-free-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { useGoBack } from '@/hooks/useGoBack';
import { useColors } from '@/constants/theme';
import { useSubscriptions } from '@/hooks/queries/useSubscriptions';
import { useUnsubscribe } from '@/hooks/mutations/useUnsubscribe';
import { SubscriptionRow } from '@/components/SubscriptionRow';
import type { Subscription } from '@/services/emailApi';

const AnimatedSubscriptionsList = Animated.createAnimatedComponent(
  FlashList as React.ComponentType<FlashListProps<Subscription>>,
) as React.ComponentType<
  AnimatedProps<FlashListProps<Subscription>> & {
    ref?: React.Ref<FlashListRef<Subscription>>;
  }
>;

export function SubscriptionsScreen() {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const minimizeTabBarOnScroll = useMinimizeOnScroll();
  const { width } = useWindowDimensions();
  const colors = useColors();
  const isDesktop = Platform.OS === 'web' && width >= 900;

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
  const [unsubscribingAddress, setUnsubscribingAddress] = useState<string | null>(null);

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
        listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
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

  const renderSeparator = useCallback(
    () => (
      <View
        style={[
          styles.separator,
          {
            backgroundColor: colors.border,
            marginLeft: 16 + insets.left,
            marginRight: 16 + insets.right,
          },
        ]}
      />
    ),
    [colors.border, insets.left, insets.right],
  );

  const renderEmpty = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        {Platform.OS === 'web' ? (
          <HugeiconsIcon
            icon={News01Icon as unknown as IconSvgElement}
            size={64}
            color={colors.border}
          />
        ) : (
          <MaterialCommunityIcons
            name="newspaper-variant-outline"
            size={64}
            color={colors.border}
          />
        )}
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          No subscriptions found
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.secondaryText }]}>
          Senders who email you frequently will appear here.
        </Text>
      </View>
    ),
    [colors],
  );

  const renderFooter = useCallback(
    () =>
      isFetchingNextPage ? (
        <View style={styles.footer}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : null,
    [isFetchingNextPage, colors.primary],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ paddingTop: isDesktop ? 0 : insets.top }}>
        <PageHeader title="Subscriptions" onBack={isDesktop ? undefined : handleBack} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <AnimatedSubscriptionsList
          ref={listRef}
          data={subscriptions}
          renderItem={renderItem}
          ItemSeparatorComponent={renderSeparator}
          ListHeaderComponent={
            <>
              <SubscriptionStacks subscriptions={subscriptions} onSelect={handleSelectSubscription} />
              {/* Scrolls with the list rather than sitting in a fixed band:
                  only the header stays put, same as the inbox. */}
              {subscriptions.length > 0 && (
                <View style={styles.subtitle}>
                  <Text style={[styles.subtitleText, { color: colors.secondaryText }]}>
                    When you unsubscribe, it can take a few days to stop receiving messages
                  </Text>
                </View>
              )}
            </>
          }
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          onScroll={minimizeTabBarOnScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching && !isFetchingNextPage}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={{
            ...(subscriptions.length === 0 ? styles.emptyListContent : null),
            paddingTop: 0,
            paddingBottom: tabBarClearance,
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  subtitle: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  subtitleText: {
    fontSize: 13,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // `marginLeft` / `marginRight` are applied inline so they can include
  // landscape `insets.left` / `insets.right`.
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 16,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyListContent: {
    flexGrow: 1,
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
