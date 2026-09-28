import { BREAKPOINTS } from '@oxy.so/bloom/styles';
import { useWindowDimensions } from 'react-native';

/**
 * Viewport width (px) at or above which the app lays out as a desktop: the
 * Bloom sidebar enters the layout and the floating tab bar is not rendered.
 */
export const DESKTOP_BREAKPOINT = BREAKPOINTS.lg;

/** Shared breakpoint for the in-flow sidebar and floating tab bar. */
export function useIsDesktopLayout(): boolean {
  const { width } = useWindowDimensions();
  return width >= DESKTOP_BREAKPOINT;
}
