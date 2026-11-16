import type {
  AppShellProps,
  AppShellPanelLayout,
  AppShellPanelDefinition,
} from '@oxy.so/bloom/app-shell';
import { BREAKPOINTS } from '@oxy.so/bloom/styles';

/** The same compositor geometry before and after account restoration. */
export const MAIL_WORKSPACE = {
  layout: 'collection-detail',
  presentation: 'framed',
  framedFrom: BREAKPOINTS.md,
  safeArea: true,
  drawer: 'reveal',
  header: null,
} satisfies Partial<AppShellProps>;

export const MAIL_PANELS = {
  collapseBelow: BREAKPOINTS.lg,
} satisfies Partial<AppShellPanelLayout>;

export const MAIL_LIST_PANEL = {
  id: 'list',
  role: 'collection',
  width: 380,
  minWidth: 320,
  maxWidth: 480,
  chrome: 'none',
  scroll: 'content',
} satisfies AppShellPanelDefinition;

export const MAIL_DETAIL_PANEL = {
  id: 'detail',
  role: 'detail',
  appearance: 'plain',
  chrome: 'none',
  scroll: 'content',
} satisfies AppShellPanelDefinition;
