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

## Verify the transition, not only the final screen

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

Check desktop and touch viewports, cold and warm cache, English and a non-English
browser locale, and stored light/dark preferences. Verify the visible shell does
not disappear or remount. Separately test delayed session restoration, account
switch, sign-out, and late preference/search callbacks. In unit hydration tests,
assert node identity survives `renderToString` → `hydrateRoot`, not just that the
final translated heading exists.

A fresh browser or synthetic mailbox fixture does not verify authenticated
account restoration. Report that distinction with the results.
