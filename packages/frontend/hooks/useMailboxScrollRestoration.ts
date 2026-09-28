import {
  useScrollRestoration,
  type ScrollableHandle,
} from '@oxy.so/bloom/scroll';
import { useMinimizeOnScroll } from '@oxy.so/bloom/tab-bar';
import type { RefObject } from 'react';
import {
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { runOnJS, useAnimatedScrollHandler } from 'react-native-reanimated';

/** Keep the same content offset when a list moves between the route and split pane. */
export function useMailboxScrollRestoration<T extends ScrollableHandle>(
  ref: RefObject<T | null>,
  key: string,
  enabled: boolean,
) {
  const { onScroll: record } = useScrollRestoration(ref, { key, enabled });
  const recorder = useAnimatedScrollHandler(
    {
      onScroll: (event) => {
        // Bloom observes the real DOM scroller on web. Native needs the offset
        // forwarded from Reanimated; the minimization handler stays on the UI thread.
        if (Platform.OS !== 'web') {
          runOnJS(record)({
            nativeEvent: event,
          } as unknown as NativeSyntheticEvent<NativeScrollEvent>);
        }
      },
    },
    [record],
  );
  const onScroll = useMinimizeOnScroll(recorder);
  return onScroll;
}
