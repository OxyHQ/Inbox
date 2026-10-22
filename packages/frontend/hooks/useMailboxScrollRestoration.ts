import { useScrollRestoration, type ScrollableHandle } from '@oxy.so/bloom/scroll';
import { useMinimizeOnScroll } from '@oxy.so/bloom/tab-bar';
import { useAnimatedScrollMetricsBinding } from '@oxy.so/bloom/layout';
import type { RefObject } from 'react';

/** Keep each mailbox offset while the shared list remains mounted across routes. */
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
