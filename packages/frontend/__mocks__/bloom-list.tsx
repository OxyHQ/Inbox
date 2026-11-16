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

/** Boundary for app content/callback tests; gesture and geometry belong to Bloom's runtime gates. */
export function ListItem({
  title,
  supporting,
  leading,
  trailing,
  footer,
  attachments,
  mail,
  onPress,
  label,
}: {
  title?: ReactNode;
  supporting?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  footer?: ReactNode;
  attachments?: ReactNode;
  mail?: { sender: { name: string }; subject: string; snippet?: string };
  onPress?: () => void;
  label?: string;
}) {
  const body = (
    <>
      {mail ? (
        <>
          {mail.sender.name} {mail.subject} {mail.snippet}
        </>
      ) : (
        <>
          <span>{title}</span>
          <span>{supporting}</span>
        </>
      )}
    </>
  );
  return (
    <div>
      {leading}
      {onPress ? (
        <button
          type="button"
          aria-label={label ?? (typeof title === 'string' ? title : undefined)}
          onClick={onPress}
        >
          {body}
        </button>
      ) : (
        body
      )}
      {trailing}
      {footer}
      {attachments}
    </div>
  );
}
