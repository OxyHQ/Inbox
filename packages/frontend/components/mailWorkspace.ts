import {
  APP_SHELL_DEFAULTS,
  type AppShellProps,
  type AppShellPanelLayout,
  type AppShellPanelDefinition,
} from '@oxy.so/bloom/app-shell';
import { BREAKPOINTS } from '@oxy.so/bloom/styles';

/** The same compositor geometry before and after account restoration. */
export const MAIL_WORKSPACE = {
  framedFrom: BREAKPOINTS.md,
  safeArea: true,
  drawer: 'reveal',
  header: null,
  contentMaxWidth: 'none',
  gutter: APP_SHELL_DEFAULTS.dashboardGutter,
} satisfies Partial<AppShellProps>;

export const MAIL_PANELS = {
  mode: 'split',
  flow: 'bounded',
  appearance: 'separated',
  collapseBelow: BREAKPOINTS.lg,
} satisfies Partial<AppShellPanelLayout>;

export const MAIL_LIST_PANEL = {
  id: 'list',
  width: 380,
  minWidth: 320,
  maxWidth: 480,
  chrome: 'none',
  scroll: 'content',
} satisfies AppShellPanelDefinition;

export const MAIL_DETAIL_PANEL = {
  id: 'detail',
  appearance: 'plain',
  chrome: 'none',
  scroll: 'content',
} satisfies AppShellPanelDefinition;
