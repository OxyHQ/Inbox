# Dependencies: the peers, the census that cannot justify a prune, and the pins

> Moved out of `AGENTS.md` unchanged. The rule stays there; this is the evidence.

Two peers reach this app only because they are declared:
`@react-native-community/netinfo` and `react-native-qrcode-svg` (hard peers of
`@oxy.so/services`). In the monorepo they arrived by hoisting from sibling
packages. Removing them lets `bun install`, `tsc`, jest and `expo export` all
pass and throws in the browser.

`expo-symbols` was a third until Bloom 15.0.0 dropped it as a peer (2026-10-19).
Nothing in the app imports it, and expo-router's peer on it is optional and
loaded inside a try/catch (only its Android native tabs use it, which Inbox does
not), so the direct dependency went with it.

**A zero-import census cannot justify pruning a dependency here.** Measured:
48 of this package's deps had zero source references (2026-09), including
`typescript`, `react-dom`, `react-native-web` and `expo-font` (and `nativewind` and
`tailwindcss`, until they went with the last `className`, below).
Build tooling, `app.config.js` plugins and peers are all invisible to it.

`babel-plugin-module-resolver` is gone. `@oxy.so/app-preset` 4 dropped it from
the Babel factory, and `@/*` now resolves from `tsconfig.json`'s `paths`, which
Metro reads by default (jest has its own `moduleNameMapper` entry).

There is no `expo.install.exclude` any more. Through SDK 57 it pinned
`react-native-keyboard-controller`, `react-native-safe-area-context` and
`react-native-svg` ABOVE what Expo bundled, because `@oxy.so/services` required
it. SDK 58 bundles those same versions (1.22.7, ~5.10.1, 15.16.0), so the
exclusions were removed in the SDK 58 upgrade and `expo install --fix` owns all
three again. If a future services release needs one above the SDK again, the
exclusion comes back with that reason next to it.

`socket.io-client` is deliberately NOT a direct dependency. It was one until
2026-09-19, when `useInboxSocket` stopped opening its own connection and moved
onto the SDK's (`docs/realtime-and-outbound.md`). It is still installed —
`@oxy.so/core` depends on it and `@gemies/sdk` peers on it — so a dependabot
PR bumping the direct range should be closed, not merged: merging re-adds the
dependency the fix removed.

## The root `overrides` are a second place versions live

`package.json` at the ROOT pins `@oxy.so/bloom`, `@oxy.so/services`,
`@oxy.so/core`, `@oxy.so/contracts` and `@oxy.so/protocol` alongside the ranges in
`packages/frontend/package.json`. A bump in one and not the other resolves to
the OLD version, silently, with no error and no warning: measured 2026-09-19,
when the frontend asked for `@oxy.so/bloom@^3.1.0` and `bun install` kept
installing 2.0.0 because the override still said `^2.0.0`. Both places move
together or neither does. It happened again on 2026-11-24: dependabot's `oxy`
group PR (#266) moved the frontend to Bloom 23.3.0 but not the root override, so
the lock and production stayed on 22.1.11 while the manifest said 23.3.0.

## What Services 15 and Gemies SDK 10 changed here

`@oxy.so/services` 15.0.0 and `@gemies/sdk` 10.0.0 keep their own data in
`@oxy.so/bloom-data` (one store per account) and dropped React Query, zustand and
NativeWind as peers. Two things follow for this manifest:

- `expo-sqlite` is a direct dependency: Services 15 requires it (each account's
  durable store is a SQLite file on a device). `@oxy.so/bloom-data` already was.
- `@tanstack/react-query` and `zustand` stay, as Inbox's OWN dependencies: the
  mail cache is Inbox's React Query client (`hooks/queries/queryClient.ts`) and
  the app stores are zustand. `@tanstack/query-async-storage-persister` and
  `@tanstack/query-sync-storage-persister` were removed: nothing in Inbox imports
  them, and they were here only as Services 14's peers.

Both SDKs now pass no `className` and type-check against Bloom 23, so
`typecheck` is plain `tsc --noEmit` again (the filtering `scripts/typecheck.mjs`
that ignored their source is gone).

## NativeWind, react-native-css and Tailwind are gone

They went when Inbox's last `className` did (2026-11-26): nothing in the app,
Services 15 or Gemies SDK 10 passes one, and Bloom 23 takes none. Removed:
`nativewind`, `react-native-css`, `tailwindcss` and `@tailwindcss/postcss`, the
root `react-native-css` override, their dependabot ignores, `postcss.config.mjs`,
`nativewind-env.d.ts`, Biome's Tailwind CSS parsing, and app-preset's
`BloomNativeWindTheme` (and its declaration). app-preset 6.9's Metro config reads
`package.json`: with no `nativewind` it applies no NativeWind wrapper, no
react-native-css runtime and no component redirect, and React Native's own
`Text`/`TextInput` carry the base face.

`global.css` stays, as plain CSS that Expo compiles itself: the element reset
Tailwind's preflight used to put in it, which gives the web document its font
(`docs/agent-rules.md`). The web export rendered pixel-identical before and after
(the signed-out shell at 1440 and 390, light and dark, with reduced motion).

The root `lightningcss` override stays. Expo's own CSS pipeline
(`@expo/metro-config`, `^1.30.1`) compiles `global.css` with it, the pin predates
any recorded reason, and dropping it would move Expo's CSS compiler in a change
that is about NativeWind. Revisit it on its own.

## Updates

Dependabot checks weekly and proposes every update (majors included) as ONE
grouped pull request per ecosystem. Because this is a Bun workspace, every accepted manifest change
must be followed by `bun install` and include the resulting `bun.lock` change.

`bun run doctor:oxy` (`oxy-doctor --ci`) is read-only. A direct Oxy range that
misses the newest release is a warning for 14 days after that release was
published, then an error that fails CI; duplicate Oxy versions in the lockfile
fail it at once. A red doctor on `main` means the upgrade window closed — bump,
that is the gate working, not a flake.

The lockfile drifts on its own too: the CI step re-resolves with
`bun install --minimum-release-age=0` and compares. When transitive packages age
past `minimumReleaseAge`, a plain `bun install` legitimately produces a
different lock and the gate reds until it is committed. Regenerate with a PLAIN
`bun install` under the pinned bun — never commit the output of the gate's
`--minimum-release-age=0`, which would pin packages the quarantine exists to
keep out.

The quarantine is for third-party packages. Every first-party package (the
Oxy SDK, Bloom, the product SDKs) is exempt by exact name in `bunfig.toml`, so a
fresh Oxy release resolves at once; `scripts/check-release-age-excludes.mjs`
(CI) fails if `bun.lock` resolves a first-party package that list misses.

Neither CI nor the application installs `latest` or modifies dependencies at
runtime.

## Compiler and schema major-version compatibility

Inbox's own `zod` follows the major `@oxy.so/contracts` publishes its schemas
with: `schemas/emailSchemas.ts` and the AI client extend and compose the
contract's schemas. Contracts 6 is on Zod 4 (`^4.6.7`), so Inbox is too. Mixing
majors produces unknown mail types and incompatible schema objects. Move them
together. The one Zod 3 left in the lock is `@expo/cli`'s own.

The Jest transformer is `ts-jest`, whose TypeScript peer range is `<7`.
TypeScript 7 has no JavaScript compiler API for this transformer; keep
TypeScript 6 until the transformer/compiler migration is validated together.
The Jest 30 upgrade itself is retained and passes the suite. Clarity 0.4's
favicon endpoint is also retained; its security test checks the new domain-only
URL rather than the old Google fallback.

`htmlparser2` parses quoted mail consistently on web and native without a DOM.
The 10.x range provides both ESM (Metro) and CommonJS (Jest) entries; the reader
uses its DOM utilities, while HtmlBody continues to own sanitization.
