import type { ReactNode } from 'react';

/** `@oxy.so/bloom/dropdown-menu` pulls in Reanimated, which cannot load under Node. Rows render inline. */
type Children = { children?: ReactNode };
type Row = Children & { onPress?: () => void; disabled?: boolean };

export const DropdownMenu = ({ children }: Children) => <>{children}</>;
export const DropdownMenuTrigger = ({ children }: Children) => <>{children}</>;
export const DropdownMenuContent = ({ children }: Children) => <div>{children}</div>;
export const DropdownMenuItem = ({ children, onPress, disabled }: Row) => (
  <button type="button" disabled={disabled} onClick={onPress}>
    {children}
  </button>
);
export const DropdownMenuCheckboxItem = ({
  children,
  onCheckedChange,
}: Children & { onCheckedChange?: (checked: boolean) => void }) => (
  <button type="button" onClick={() => onCheckedChange?.(true)}>
    {children}
  </button>
);
