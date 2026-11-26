# Agent rules: the reasoning behind AGENTS.md

`AGENTS.md` is size-budgeted (`bun run validate:agents-md`), so each rule there
is one line. This file holds the reasons and the traps behind them.

## There is no backend here

Mailboxes, threads, labels, filters, federation, SMTP and webhook ingest are all
`@oxy.so/api` in OxyHQ/oxy (~8 200 lines there). This repo is a client.

Things that stay in OxyHQ/oxy and name this origin; do not "clean them up" from
there: the API's CORS allowlist (`dynamicOriginRegistry.ts`), `@oxy.so/core`'s
official-origin allowlists (`server/cors.ts`, `utils/oauthPkce.ts`) and the
tests asserting them, the seeded Oxy application's `redirectUris`, and SMTP's
ARF `reportingUA`. Deleting the first is a total outage; deleting the fourth
silently degrades outbound deliverability. `packages/inbox` was code that
moved; `inbox.oxy.so` is an origin that did not (it redirects to `inbo.sh`).

## `linker = "hoisted"` is not a preference

It was introduced for `@oxy.so/app-preset/css/base.css`, whose relative
`@source` globs found the SDK's class names only in a hoisted `node_modules`.
That reason left with NativeWind and Tailwind (2026-11-26). It stays because
nothing has proven the app under bun's isolated linker since: the preset's
Metro config resolves from `[packages/frontend/node_modules,
node_modules]` and two required peers of `@oxy.so/services` are reached by
hoisting (`bunfig.toml`). Changing it needs `bun run test`, the web export and
an Android build on an isolated install, not a green `bun install`.

## The web's global stylesheet is plain CSS

`packages/frontend/global.css` is no longer Tailwind: it is the element reset
Tailwind's preflight used to compile into it, rule for rule, in `@layer base`.
It is what gives the document its font: react-native-web's base face is
`font-family: inherit` on a `Text` that names no family, so React Navigation's
tab labels and the web composer's editable area take the document's font.
Without the stylesheet they fall back to the browser's serif, and nothing
errors. The deploy gate checks that the exported `global-*.css` exists, sets
`font-family: var(--bloom-font-sans…)` on `html` and is linked by every page.

## `expo export` bundles through type errors

So `typecheck` runs before the export, in CI and in the deploy.
`experiments.typedRoutes` does not make CI stricter: `.expo/` is gitignored and
nothing in CI generates `router.d.ts`, so expo-router's `Href` degrades to
`string | HrefObject`, which is strictly more permissive. Route strings are not
gated in CI. The deploy re-runs `typecheck` after `build`, when `expo export`
has written `.expo/types` as a side effect; that run is the real gate.

## The suite is jest; `bun test` is refused

`bun test` ignores `jest.config.js` and half-runs the suite, printing a
plausible smaller number rather than an error. Both `bunfig.toml` files preload
`packages/frontend/scripts/refuse-bun-test.ts` to abort it. Run `bun run test`.

## No root tsconfig

Deliberate divergence from Atlas, whose root solution file needs
`composite: true`, which `packages/frontend/tsconfig.json` (extends
`expo/tsconfig.base.json`) does not set. Typecheck via `bun run typecheck`.

## Dependencies

There is no catalog and one package, so never a `catalog:` or `workspace:*`
specifier. After any `package.json` change run `bun install` and commit
`bun.lock` in the same commit.

A zero-import census cannot justify pruning a dependency here: 48 of this
package's deps have zero source references, build tooling and hard peers
included. Declared peers and the measured census: [dependencies.md](./dependencies.md).

## Oxy SDK conventions

- Import `@oxy.so/services/ui/client` (or `/ui`) over the root barrel: the root
  registers every account screen into web first paint.
- One provider: `OxyProvider` with `clientId` + `authRedirectUri`. Sign-in is
  the in-app `OxyAccountDialog` behind `RequireOxyAuth`, never a redirect to
  auth.oxy.so.
- Config comes from `@oxy.so/app-preset` (Metro, Babel, base CSS). Fix the
  preset upstream; never copy config back into the app.
- Theming is Bloom tokens, through Bloom components, the Bloom language and
  React Native styles. There is no NativeWind and no `className`. Never hardcode
  brand colours, never redefine `--bloom-*`.
- Realtime rides the SDK's socket via `useOxyEvent`. Never open a second `io()`:
  [realtime-and-outbound.md](./realtime-and-outbound.md).
