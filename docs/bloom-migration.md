# Inbox UI migration to Bloom

Inbox uses one responsive Expo tree for web and Android. Mail is the primary
workspace; the brief and Alia open on demand.

## Component ownership

| Surface | Shared Bloom primitives | Inbox responsibilities |
| --- | --- | --- |
| Workspace | AiChatShell, AiChatContainer, AppShellSplitPanes, Sidebar, BottomBar, Fab | Mailbox/label destinations and SDK account actions |
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

- The workspace uses the same Bloom composition as Alia: `AiChatShell`,
  one `AiChatContainer` per pane, a default `Sidebar` in flow and a `mobile surface="plain"`
  copy in the reveal drawer. Bloom owns margins, surfaces, rounding, the
  reveal animation, swipe gestures, dismissal and focus behavior.
- The split primitive's `variant="separated"` gives the list and detail their
  own rounded Bloom containers, with a Bloom-owned 12px gutter between them.
  The existing resize handle sits in that gutter. There is no shared outer
  card, app-defined border/radius, or custom divider. A solo mobile pane has
  no inter-panel gutter.
- At Bloom's `lg` breakpoint (1024px), `AppShellSplitPanes` keeps the list
  beside the routed conversation/composer. Its shared divider is adjustable
  from 320–480px, initially 380px. Below `lg`, index routes render the list
  and conversation routes render the message in the same detail slot. The
  navigator stays mounted, preserving open drafts through a width change.
- `PageHeader` and `ButtonGroup` follow Alia's inline chrome: no scrim, no
  sticky header or app-owned surface. Routes remain transparent, each pane
  owns its scrolling, and the mobile `BottomBar` sits in the container slot.
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

## Surface and inset ownership

`AiChatShell safeArea` consumes native device insets once for the workspace and
reveal drawer. Its bottom-slot context prevents the mobile bar adding the same
inset again; the original device context remains available to portaled dialogs.
Web geometry is unchanged. Inner `PageHeader` instances opt out with
`safeArea={false}`. Inbox has no per-screen `useSafeAreaInsets`, `SafeAreaView`,
or tab-bar-clearance helper.

Mailbox, search, subscriptions, conversation, compose and not-found routes all
inherit the Bloom panel's surface. The router scenes are transparent.
`MailComposeSurface variant="sheet"` inherits the parent fill instead of drawing
another panel. The HTML message host is transparent too; sender-provided email
formatting and the printable document retain their own content styling.

Custom touch targets and painted controls were replaced with Bloom cards,
chips, empty states, accordion, keyboard keys, avatars and buttons. The editor
uses `NoteEditorToolbar`, a Bloom link dialog and native `Textarea`. Mail parsing,
mutations, safe HTML rendering and the web editable-document engine stay in Inbox:
Bloom explicitly exposes the compose body as a slot rather than a rich-text engine.
Content grouping still uses ordinary flex containers and NativeWind spacing;
it does not recalculate panel margins, surfaces or safe areas.

## Shared library dependency

The integration uses Bloom **5.4.0** together with Services 9,
Core 3.2 and App Preset 2.2 from main. Bloom [#234](https://github.com/OxyHQ/Bloom/pull/234)
carries mail density/settings improvements, [#242](https://github.com/OxyHQ/Bloom/pull/242)
fixes MailRow pointer hit testing, and [#243](https://github.com/OxyHQ/Bloom/pull/243)
provides separated split panes, shell safe-area ownership and editor icons.
The earlier Bloom 4 maintenance releases were only used to validate the isolated
layout branch; the final main integration retains the newer SDK and Bloom APIs.

Both manifests and the lockfile resolve the published library normally. There
are no local Bloom copies or package patches. The obsolete maintenance exception
and its tests have been removed from the Doctor wrapper: all dependency-health
findings now fail the gate.

## Validation

The local validation run passed 34 Jest suites (168 tests), lint and TypeScript.
The web export emits 59,815 bytes of CSS (above the 20 KB floor), and the post-export TypeScript check
also passed. The current-major integration export uses `--max-workers 2`.
The previous layout revision was smoke-tested in a locally compiled
Android client. This cleanup is checked by Android export and Bloom's simulated
iOS/Android inset regressions; it has not been exercised on a physical device.

The Jest suite covers recipient draft preservation, existing composer/reply and
HTML safety, account-scoped search retention, mailbox navigation, settings deep
links/account handoff, bottom navigation and swipe action dispatch. Run
`bun run test`, never `bun test`.

Local browser fixtures use the real `InboxList`/FlashList, Bloom shell and mail
components with mocked mail/account hooks. The mailbox now has a Bloom PageHeader
and one shared content width for its header, controls and rows. They verify 390/900/1023/1024/1440px layouts, pointer navigation with the list retained beside the conversation on wide screens, light/dark modes,
recipient/subject preservation on resize, and scroll restoration. The reveal drawer
is checked by pointer opening, Escape and veil dismissal, including the actual
272px workspace translation. These are
UI checks, not authenticated mail-delivery end-to-end tests. A second fixture
renders the migrated controls and verifies editor selection/formatting/link
insertion, unreadable-message retry/original actions, summary collapse, saved
search activation and reminder dismissal. Wide and narrow layouts report no
JavaScript errors or page overflow.

Run `bun run typecheck` before and after `bun run build`; verify the generated
web CSS exceeds 20 KB. An Android export validates the native import graph;
a running native client is additionally needed to validate gestures, keyboard
and hardware-back behavior. Merging to main uses the existing deployment workflow.

## UI fixtures

![Desktop mailbox fixture](images/bloom-mail-desktop.png)

![Mobile mailbox fixture](images/bloom-mail-mobile.png)
