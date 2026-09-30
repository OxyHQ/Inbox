# Dependencies: the peers, the census that cannot justify a prune, and the pins

> Moved out of `AGENTS.md` unchanged. The rule stays there; this is the evidence.

Three peers reach this app only because they are declared: `expo-symbols`
(hard peer of `@oxy.so/bloom`), `@react-native-community/netinfo` and
`react-native-qrcode-svg` (hard peers of `@oxy.so/services`). In the monorepo
they arrived by hoisting from sibling packages. Removing them lets `bun install`,
`tsc`, jest and `expo export` all pass and throws in the browser.

**A zero-import census cannot justify pruning a dependency here.** Measured:
48 of this package's deps have zero source references, including `nativewind`,
`tailwindcss`, `typescript`, `react-dom`, `react-native-web`, `expo-font` and
`babel-plugin-module-resolver` (which `babel.config.js` names `module-resolver`,
and which makes the `@/*` alias work at runtime). Build tooling, `app.json`
plugins and peers are all invisible to it.

`expo.install.exclude` pins three packages ABOVE what SDK 57 bundles because
`@oxy.so/services` requires it. Nothing in CI runs `expo install --fix`, so the
exclusions look like dead config — they are not.

`socket.io-client` is deliberately NOT a direct dependency. It was one until
2026-09-19, when `useInboxSocket` stopped opening its own connection and moved
onto the SDK's (`docs/realtime-and-outbound.md`). It is still installed —
`@oxy.so/core` depends on it and `@alia.onl/sdk` peers on it — so a dependabot
PR bumping the direct range should be closed, not merged: merging re-adds the
dependency the fix removed.

## The root `overrides` are a second place versions live

`package.json` at the ROOT pins `@oxy.so/bloom`, `@oxy.so/services`,
`@oxy.so/core` and `@oxy.so/contracts` alongside the ranges in
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

Inbox remains on Zod 3 while `@oxy.so/contracts` publishes Zod 3 schemas.
Mixing those schemas with Zod 4's inference and composition APIs produces
unknown mail types and incompatible schema objects. Move them together.

The Jest transformer is `ts-jest`, whose TypeScript peer range is `<7`.
TypeScript 7 has no JavaScript compiler API for this transformer; keep
TypeScript 6 until the transformer/compiler migration is validated together.
The Jest 30 upgrade itself is retained and passes the suite. Clarity 0.4's
favicon endpoint is also retained; its security test checks the new domain-only
URL rather than the old Google fallback.
