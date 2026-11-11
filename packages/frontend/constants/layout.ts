/**
 * Layout scale for the message surfaces (inbox rows, Today cards, the Today
 * feed).
 *
 * These exist so alignment is a property of the system rather than of each
 * component: a row, a card header and a card item all inset by `SPACING.lg`.
 * Changing the rhythm means changing it here, once.
 */

/** 4dp-based spacing steps. Anything in between is a bug, not a decision. */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;
