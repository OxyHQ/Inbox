import type { ReactNode } from 'react';

type Slot = ReactNode | (() => ReactNode);
const slot = (value: Slot) => (typeof value === 'function' ? value() : value);

/** `@oxy.so/bloom/list` pulls in Reanimated, which cannot load under Node. */
export function VirtualList<T>({
  data,
  renderItem,
  ListHeaderComponent,
  ListEmptyComponent,
  ListFooterComponent,
}: {
  data?: readonly T[] | null;
  renderItem?: (info: { item: T; index: number }) => ReactNode;
  ListHeaderComponent?: Slot;
  ListEmptyComponent?: Slot;
  ListFooterComponent?: Slot;
}) {
  return (
    <div>
      {slot(ListHeaderComponent)}
      {data?.length
        ? data.map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a stub list has no row identity
            <div key={index}>{renderItem?.({ item, index })}</div>
          ))
        : slot(ListEmptyComponent)}
      {slot(ListFooterComponent)}
    </div>
  );
}
