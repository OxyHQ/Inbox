import { useTabBarFootprint } from '@oxyhq/bloom/tab-bar';

import { useIsDesktopLayout } from '@/hooks/useIsDesktopLayout';

const CLEARANCE = 12;

/** Bloom tab-bar footprint plus the breathing room required by scroll content. */
export function useTabBarClearance(): number {
  const footprint = useTabBarFootprint();
  const isDesktopLayout = useIsDesktopLayout();
  return isDesktopLayout ? 0 : footprint + CLEARANCE;
}
