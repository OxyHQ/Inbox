import { useScrollRestoration, type ScrollableHandle } from '@oxy.so/bloom/scroll';
import { useMinimizeOnScroll } from '@oxy.so/bloom/tab-bar';
import { useAnimatedScrollMetricsBinding } from '@oxy.so/bloom/layout';
import type { RefObject } from 'react';

/** Keep the same content offset when a list moves between the route and split pane. */
export function useMailboxScrollRestoration<T extends ScrollableHandle>(
  ref: RefObject<T | null>,
  key: string,
  enabled: boolean,
) {
  const { onScroll: record } = useScrollRestoration(ref, { key, enabled });
  const handler = useMinimizeOnScroll();
  const { onScroll } = useAnimatedScrollMetricsBinding({
    handler,
    onScroll: record,
  });
  return onScroll;
}
