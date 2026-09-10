import { useWindowDimensions } from 'react-native';

/**
 * Viewport width (px) at or above which the app lays out as a desktop: the
 * mailbox drawer becomes `permanent` and the floating tab bar is not rendered.
 */
export const DESKTOP_BREAKPOINT = 900;

/** Shared breakpoint for the permanent drawer and floating tab bar. */
export function useIsDesktopLayout(): boolean {
  const { width } = useWindowDimensions();
  return width >= DESKTOP_BREAKPOINT;
}
