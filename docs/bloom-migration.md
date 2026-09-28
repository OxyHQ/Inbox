# Inbox UI migration to Bloom

Inbox uses one responsive Expo tree for web and Android. Mail is the primary
workspace; the brief and Alia open on demand.

## Component ownership

| Surface | Shared Bloom primitives | Inbox responsibilities |
| --- | --- | --- |
| Workspace | AppShell with ContentPanel, Sidebar, BottomBar, Fab | Mailbox/label destinations and SDK account actions |
| Mail list | MailRow, MailSelectionBar, SwipeRow | Virtualization, grouping, unreadable rows, bulk mutations and preferences |
| Conversation | PageHeader, MailThread, MailMessage | Safe HTML/CID resolution, unreadable entries, downloads, reply targets |
| Composer | MailComposeSurface, MailRecipientField, TextFieldInput | Recipient validation/suggestions, editor, draft recovery, RFC reply headers and outbound queue |
| Settings | SettingsModal and its page/row templates | Existing preferences, forms, mutations and bookmarked route compatibility |
| Search | Search, Chip, EmptyState, Loading | Local operators, opt-in inference, saved/recent searches and pagination |

The custom drawer, tab bar, settings navigation, floating-header hook, row
density geometry and independent color palette are removed. Structured mail
cards and the HTML editor remain domain-specific; neither is reimplemented by
this migration. Colors now come from semantic Bloom roles.

## State and navigation

- The shell changes at 900px; the sidebar expands at 1200px. These thresholds
  apply to every platform. The same route stack remains mounted through a width
  change so a composer does not restart.
- Lists, search, conversations and composition occupy one routed content panel
  at every width. There is no permanent empty detail column. The desktop sidebar
  uses Bloom’s default card, with an 8px gutter; mobile is full-bleed. The shell
  owns the panel surface and route scenes stay transparent. This follows the
  surface ownership used by Alia and Mention.
- Search state lives above the route stack. Its lifetime is
  scoped to the SDK user ID; switching accounts or signing out clears it.
  Outstanding interpretation/debounce callbacks cannot update a new session.
- Bloom stores scroll offsets under account + mailbox/search identity. The
  shell's current detail route is deliberately not part of the list identity.
- A completed swipe still executes the configured mail action. Disabling a
  direction leaves it inert. Selection keeps the same bulk mutations.
- Recipient fields retain incomplete input on every keystroke, including Cc
  and Bcc, so validation and local draft recovery see what the user typed.
- Existing `/settings/*` URLs open the matching Bloom settings page. Opening
  settings from the normal navigation preserves the current mail/compose route.

## Shared library dependency

Bloom PR [#234](https://github.com/OxyHQ/Bloom/pull/234) supplies `cozy` density
and `showAvatar` while preserving existing defaults. It also fixes settings
keyboard dismissal/focus using Bloom's existing modal keyboard primitive.
The 4.34.2 patch also fixes MailRow pointer hit testing: inert visual content
passes clicks to the row action, while selection, star and archive controls
remain independent. Real browser pointer tests cover all three densities.
The shared fix is tracked in [Bloom #242](https://github.com/OxyHQ/Bloom/pull/242).
Both manifests and `bun.lock` pin the published maintenance release **4.34.2**.
Validation uses a clean registry installation, with no local package copy or patch.
The maintenance releases use npm's `inbox-maintenance` tag, preserving
`latest` (4.35.0 when 4.34.1 shipped; 5.1.1 when 4.34.2 shipped). [Bloom PR #234](https://github.com/OxyHQ/Bloom/pull/234) carries the
additive changes forward separately.

The Doctor wrapper uses the published `@oxy.so/doctor` inspection API. It reports
one explicit deferral: Bloom's 4.35.0 update, while the frontend declaration,
root override and sole locked version are exactly 4.34.2. All other findings
still fail CI, including a newer registry release, changed pin or duplicate
installation. Remove this narrow exception when adopting the next Bloom release;
that update needs separate compatibility review. Tests cover the fail-closed
conditions. This keeps the approved maintenance release isolated without claiming
compatibility with the unrelated 4.35.0 changes.

## Validation

The local validation run passed 34 Jest suites (167 tests), lint and TypeScript.
The web export exceeds the 20 KB CSS floor, and the post-export TypeScript check
also passed. A locally compiled Android debug client and the exported web app
both reached the signed-out access screen without JavaScript errors.

The Jest suite covers recipient draft preservation, existing composer/reply and
HTML safety, account-scoped search retention, mailbox navigation, settings deep
links/account handoff, bottom navigation and swipe action dispatch. Run
`bun run test`, never `bun test`.

Local browser fixtures use the real `InboxList`/FlashList, Bloom shell and mail
components with mocked mail/account hooks. The mailbox now has a Bloom PageHeader
and one shared content width for its header, controls and rows. They verify 390/899/900/1440px layouts, light/dark modes,
recipient/subject preservation on resize, and scroll restoration. These are
UI checks, not authenticated mail-delivery end-to-end tests.

Run `bun run typecheck` before and after `bun run build`; verify the generated
web CSS exceeds 20 KB. An Android export validates the native import graph;
a running native client is additionally needed to validate gestures, keyboard
and hardware-back behavior. No production deployment is part of this change.

## Current dependency-health gate

During the layout correction, npm advanced to Bloom 5.1.0 and Services 9.1.0.
Doctor correctly rejects these unreviewed major-version gaps; the existing
4.35.0 maintenance exception does not suppress them. The layout's local tests,
typechecks and exports pass with the pinned library, but the PR remains draft
until the separate SDK compatibility update is resolved.

## UI fixtures

![Desktop mailbox fixture](images/bloom-mail-desktop.png)

![Mobile mailbox fixture](images/bloom-mail-mobile.png)
