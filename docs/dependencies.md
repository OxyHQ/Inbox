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
48 of this package's deps have zero source references, including `nativewind`,
`tailwindcss`, `typescript`, `react-dom`, `react-native-web` and `expo-font`.
Build tooling, `app.json` plugins and peers are all invisible to it.

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
`@oxy.so/core` depends on it and `@alia.onl/sdk` peers on it — so a dependabot
PR bumping the direct range should be closed, not merged: merging re-adds the
dependency the fix removed.

## The root `overrides` are a second place versions live

`package.json` at the ROOT pins `@oxy.so/bloom`, `@oxy.so/services`,
`@oxy.so/core`, `@oxy.so/contracts` and `@oxy.so/protocol` alongside the ranges in
`packages/frontend/package.json`. A bump in one and not the other resolves to
the OLD version, silently, with no error and no warning: measured 2026-09-19,
when the frontend asked for `@oxy.so/bloom@^3.1.0` and `bun install` kept
installing 2.0.0 because the override still said `^2.0.0`. Both places move
together or neither does.

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
