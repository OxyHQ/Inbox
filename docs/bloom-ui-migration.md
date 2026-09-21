# Bloom UI foundation

Inbox composes Bloom's dashboard template primitives directly: `AppShell`,
`Sidebar`, and `BottomBar` with its FAB action. The app provides mail destinations,
unread counts, mutations, and the SDK `ProfileButton` footer. Below the shared
900px breakpoint the shell reveals the sidebar and moves the complete workspace,
including the bottom bar. There is no separate absolute navigation/FAB host.

Email remains a bounded workspace: its virtualized list and reader own scrolling.
`AppShell scroll="fixed"` does not nest the router in another scroller. Search
headers stay in normal flow above their lists, without measured padding or a
scroll-synchronized absolute gradient.

Settings use one imperative `SettingsModal`, its navigation and responsive back
stack. The former settings routes, desktop sidebar, landing/hero cards, screen
headers, subsection chrome and color-picker grid have been removed. Bookmarked
`/settings/*` routes open the appropriate modal page over the inbox. A committed
open request sets `initialView="page"` before opening a deep link; ordinary
settings navigation starts at the compact section list. Private sections are
excluded when signed out. The Oxy account surface opens only after modal exit.

All settings pages compose `SettingsGeneralPage` / `SettingsProfilePage` or their
`SettingsSection` / `SettingsCard` / `SettingsRow` parts, with Bloom fields,
selects, switches, textareas and buttons. Their original data hooks, validation,
draft state, mutations and confirmation handlers remain. Storage shows real mail
quota through settings rows: `SettingsStoragePage` requires an independent file
inventory/upload API which Inbox does not expose, so no file inventory or demo
upload is fabricated.

Colors come from Bloom's resolved surface/foreground pairs. The app stylesheet
only imports the shared preset and declares source scanning; it does not override
root tokens. Label and bundle colors remain user data. HTML email retains sender
styling while its fallback text/background follow Bloom's current theme.

Mail API, cache, outbound delivery, auth and account switching remain the existing
implementations. Folder deletion is available through long press and a
keyboard-accessible Folders dialog. Compose payload/recipient/save-queue helpers
live in pure utility modules, independently testable without loading UI or SDKs.

Validation covers the app test suite, settings deep-link sequencing and auth
boundary, navigation/folder mutations, TypeScript, lint, web/Android exports, and
real browser geometry. Browser fixtures use real Bloom/app UI with mocked
accounts, routing and mail data; no messages are sent or real mailboxes mutated.
A native export validates the native import graph, not device interactions.
