# Startup continuity

Removing a spinner does not make startup continuous. A loading-only `AppShell`
can paint immediately and still disappear when authentication replaces it with
the routed workspace. Keying a provider above that shell by account also
remounts it when the SDK restores the signed-in user.

Keep the public workspace mounted while identity and account-owned content
resolve. Authentication still gates private content and actions; the SDK owns
account query restoration, clearing and mutation replay. Never show one account's
mail, labels, search or saved preferences while another account is resolving.
Preference and search resets must not require replacing the whole workspace, and
late callbacks from an old account must not affect a new session.

The exported HTML and first hydration render must agree. The export has the
default English locale, whereas the SDK may immediately report a browser or
stored language. Match the server locale during hydration, then update text and
direction in place. Bloom's own locale loading must preserve already rendered
children too. Do not insert an empty frame while loading a dictionary.

The browser hydrates `#root`, so the server must render the app at that same
React boundary. Expo 58’s document wrapper adds sibling paths to `useId` during
export; scoped stylesheet text then mismatches even when it looks identical.
The shared app-preset `staticHydrationBoundary` option separates the app and
HTML document renders. Keep this correction in the preset, never rewrite IDs or
suppress hydration errors in Inbox.

Local web development must hydrate too. Expo defaults `EXPO_WEB_DEV_HYDRATE`
to false: it serves the static workspace but then calls `createRoot`, replacing
that entire DOM when the development bundle arrives. The `start` and `web`
commands enable this supported flag so local reloads exercise hydration instead.
The preset's static app/document boundary applies in development as well as
export; do not substitute a local DOM replacement for production hydration QA.
Development also needs Expo's `withDevTools` wrapper on both sides. Its app and
refresh-indicator siblings change React's `useId` paths even while the indicator
renders nothing. The app-preset 3.6.1 correction reuses Expo's actual web wrapper
around the server app in development, matching the client without rewriting IDs
or disabling Fast Refresh. Production retains its existing wrapper-free tree.

Static export must also finish large Suspense boundaries without JavaScript.
Waiting for a streaming renderer’s `allReady` is insufficient: completed content
can still be emitted as hidden segments with recovery scripts. The preset uses
React’s static `prerender` API with an unlimited progressive chunk size in both
passes, and rejects unexpected content outside the app root. Test a suspended
subtree larger than React’s default chunk threshold, then confirm the real
export paints its workspace with JavaScript disabled.

Visible navigation must also reserve its space before hydration. A bottom bar
can paint correctly while covering a full-height panel, then shrink that panel
when its first `onLayout` measurement arrives. Bloom owns this geometry: its
bounded web shell keeps the reserved bottom bar in flex flow, so the browser
allocates the bar's actual height from the server HTML. Do not duplicate a fixed
bar height or compensate with padding in Inbox. Measurements still inform
overlays and bottom-edge claims without reserving the same space twice. When
responsive navigation changes, Bloom registers or releases those claims before
paint. Native, document-scrolling and explicitly unreserved slots retain their
own layout behavior.

A persistent outer shell is insufficient if its list is still a loading-only
screen. Keep the actual mailbox header and public navigation mounted while the
private list body waits for SDK readiness. Bloom selects that same list panel
on compact mailbox routes and the detail panel on conversation/compose routes;
do not mount another full list in a CSS-hidden route. The exported shell uses
the index-route snapshot during hydration before applying the live deep link.

Dynamic links without a matching exported HTML file receive the index fallback;
other routes can have their own static documents. Every document uses the same
public empty-detail outlet for SSR and first hydration, then mounts the live Slot
afterward. Matching the shell pathname alone cannot reconcile different route
children. Keep the root navigator and real mailbox chrome mounted, and retain
private guards inside each route. Client-only/native renders use the live outlet
immediately. Test index HTML hydrated at different direct URLs, including the
selected navigation tab, with no recoverable errors or replaced workspace.

Query clients derive synchronously from the SDK's ready HTTP client. A drawer
mount effect must not add another render before mailbox, message and brief
queries can start. Keep the SDK's account-cache readiness and schema/build
buster: a disabled query can still return cached data, so hooks above the
private boundary also mask their data until the current account is ready.
Private dialogs and routed content reset by account epoch without replacing the
header. Shared query keys deduplicate the shell, list and brief consumers.

Persisted inbox choices also need a server snapshot now that the real header
renders before authentication. Use defaults for SSR and the first hydration,
then apply the stored choices in place. Keep actual choices separately from
that render snapshot and never persist the snapshot over them. Access to the
localStorage getter itself can throw; catch it along with getItem/setItem.

Bloom also owns the pre-hydration palette. The document's `BloomThemeHead` and
root provider share `INBOX_THEME_BOOTSTRAP`, including the existing device mode
storage key. Use `useThemePaint` for final app styles, retaining raw theme colors
only for calculations. This lets the first HTML paint honor system/stored mode
without a light inline shell surviving a dark hydration. The preset hashes the
completed document's bootstrap script for CSP; do not copy its script or palette
into Inbox.

The last account palette must also survive a reload. `useAccountColor` applies
the account's preset after identity resolves; without Bloom persistence every
reload starts in `oxy` and then repaints the entire workspace in the account's
color. The shared bootstrap config's `persistKey` selects Bloom's own JSON theme
storage, with synchronous web storage and AsyncStorage on native. The existing
`inbox_theme_preference` mode key takes priority over the JSON mode so this does
not change an established light/dark choice. Keep `awaitHydration={false}` on
the root: theme restoration must not replace the public workspace with a blank
loading state. The SDK remains authoritative when the account resolves.

This stores a cosmetic device preference, not account content or credentials.
A device with no saved palette cannot know its account's color before identity
arrives; once that color is applied, subsequent reloads can paint it immediately.
Verify a saved non-default palette from the first HTML frame through restoration
of that same account, including the gradients and scoped surfaces. Testing only
anonymous visitors in the default `oxy` palette misses this transition.

## Verify the transition, not only the final screen

Fonts are part of that first frame. Bloom's server font rules and
`BloomFontHead` in the document head declare and preload the same canonical font
assets before the app bundle arrives. Keep this in Bloom; do not copy asset URLs
or inject preloads from a client component. A stable `font-family` string and
element rectangle do not prove the font is painted: record actual glyphs and
font readiness through a cold reload as well as a reload with cached fonts.

Use a foreground browser against the exported production build. Observe from the
first visible workspace through hydration and session resolution; a screenshot
after network idle cannot detect a blank interval or a replaced shell. Record
both uncaught exceptions and console errors, including recoverable hydration
errors. An error boundary can render content while startup has failed.

Also load the export with JavaScript disabled and inspect painted pixels and
element bounds. Text in the HTML is not proof of a visible first frame: a CSS
breakpoint can hide the only heading when Bloom's server layout has one panel.
Use the compositor's actual panel state for panel-dependent content, and verify
that the shared shell's geometry and navigation paint before hydration.

Record each visible panel's width, height and top/bottom bounds together with
the bottom bar's bounds, both without JavaScript and on animation frames through
hydration. A stable DOM node and width do not catch a panel shrinking under a
newly measured bar. At a fixed viewport, the panel and bar must already occupy
their final space in the server paint; also verify overlays do not consume the
bar's height a second time. Keep the browser foregrounded and confirm that the
probe collected multiple frames.

Check desktop and touch viewports, cold and warm cache, English and a non-English
browser locale, and stored light/dark preferences. Verify the visible shell does
not disappear or remount. Separately test delayed session restoration, account
switch, sign-out, and late preference/search callbacks. In unit hydration tests,
assert node identity survives `renderToString` → `hydrateRoot`, not just that the
final translated heading exists.

A fresh browser or synthetic mailbox fixture does not verify authenticated
account restoration. Report that distinction with the results.

For authenticated startup, record the real header text and identity, first mail
row's bounds, and brief-card arrival through identity → token → cache → messages
→ brief. A stable outer shell can conceal an `Inbox` placeholder being replaced
by the actual header, or an empty-state flash before messages arrive. Check both
restored messages/brief and cold network responses; a newly generated brief may
naturally reorganize its selected messages, while a restored brief should appear
with the restored list. Never count anonymous shell checks as this coverage.
