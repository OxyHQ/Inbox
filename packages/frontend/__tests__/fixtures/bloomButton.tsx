import type { ReactNode } from 'react';

/** Shared DOM stand-in for Bloom22's single button and composition group. */
function ButtonControl({
  children,
  onPress,
  accessibilityLabel,
  disabled,
  loading,
  pressed,
  onPressedChange,
}: {
  children?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  pressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-label={accessibilityLabel}
      aria-busy={loading || undefined}
      aria-pressed={pressed}
      disabled={disabled || loading}
      onClick={() => {
        onPress?.();
        onPressedChange?.(!pressed);
      }}
    >
      {children}
    </button>
  );
}
export const Button = Object.assign(ButtonControl, {
  Group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
});
