import type { ReactNode } from 'react';

/** `@oxy.so/bloom/layout` pulls in Reanimated, which cannot load under Node. */
export function ScrollArea({ children }: { children?: ReactNode }) {
  return <div>{children}</div>;
}
