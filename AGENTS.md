# Inbox — email at inbox.oxy.so

> Universal standards live in `~/AGENTS.md`, Oxy-wide gotchas in `~/Oxy/AGENTS.md`.
> Files stack root→cwd and a child carries only its own DELTA, so this file holds
> only what is true HERE. **Budget: under 4 KB**, enforced by `scripts/check-agents-md-size.mjs` (`bun run validate:agents-md`).

Expo Router app, web (Cloudflare Pages project `oxy-inbox`) + Android.
Extracted from `OxyHQ/oxy` `packages/inbox` in 2026-08, history preserved.

## There is no backend here

Mailboxes, threads, labels, filters, federation, SMTP and webhook ingest are all
`@oxyhq/api` in OxyHQ/oxy (~8 200 lines there). This repo is a client.

Things that stay in OxyHQ/oxy and name this origin — **do not "clean them up"
from there**: the API's CORS allowlist (`dynamicOriginRegistry.ts`),
`@oxyhq/core`'s official-origin allowlists (`server/cors.ts`,
`utils/oauthPkce.ts`) *and the tests asserting them*, the seeded Oxy
application's `redirectUris`, and SMTP's ARF `reportingUA`. Deleting the first
is a total outage; deleting the fourth silently degrades outbound
deliverability. **`packages/inbox` was code that moved; `inbox.oxy.so` is an
origin that did not.**

## `linker = "hoisted"` is not a preference

`@oxyhq/app-preset/css/base.css` finds Bloom's and the SDK's class names through
RELATIVE `@source` globs (`../../services/lib`, `../../bloom/lib`). They resolve
only in a hoisted `node_modules`. Under bun's default isolated linker they match
nothing, Tailwind emits a stylesheet with no SDK utilities in it, and web layout
silently falls back to react-native-web's base reset. Nothing errors. The gate is
a byte floor on `dist/_expo/static/css/global-*.css` (≥20 KB) — a screenshot
cannot see it, because Bloom sets colours inline and only *layout* breaks.

## `expo export` bundles through type errors

So `typecheck` runs BEFORE the export, in CI and in the deploy. Note that
`experiments.typedRoutes` does **not** make CI stricter: `.expo/` is gitignored
and nothing in CI generates `router.d.ts`, so expo-router's `Href` degrades to
`string | HrefObject`, which is strictly more permissive. Route strings are not
gated in CI. The deploy re-runs `typecheck` after `build`, when `expo export`
has written `.expo/types` as a side effect — that run is the real gate.

## The suite is jest; `bun test` is refused

`bun test` ignores `jest.config.js` and half-runs the suite, printing a
plausible smaller number rather than an error. Both `bunfig.toml` files preload
`packages/frontend/scripts/refuse-bun-test.ts` to abort it. Run `bun run test`.

## No root tsconfig

Deliberate divergence from Atlas, whose root solution file needs
`composite: true` — which `packages/frontend/tsconfig.json` (extends
`expo/tsconfig.base`) does not set. Typecheck via `bun run typecheck`.

## Dependencies

Never a `catalog:` or `workspace:*` specifier — there is no catalog and one
package. After any `package.json` change run `bun install` and commit `bun.lock`
in the SAME commit.

**A zero-import census cannot justify pruning a dependency here** — 48 of this
package's deps have zero source references, build tooling and hard peers
included. The three declared peers, the measured census and the
`expo.install.exclude` pins: `docs/dependencies.md`.

## Oxy SDK conventions

- **One provider:** `OxyProvider` from `@oxyhq/services` with `clientId` +
  `authRedirectUri`. Sign-in is the in-app `OxyAccountDialog` behind
  `RequireOxyAuth` — never a redirect to auth.oxy.so.
- **Config** comes from `@oxyhq/app-preset` (Metro, Babel, ESLint, base CSS).
  Fix the preset upstream; never copy config back into the app.
- **Theming** is Bloom tokens + NativeWind classNames. Never hardcode brand
  colours, never redefine `--bloom-*`.
