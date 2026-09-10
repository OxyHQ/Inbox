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

## Updates

Dependabot checks weekly and groups `@oxy.so/*` releases into one reviewable
pull request. Because this is a Bun workspace, every accepted manifest change
must be followed by `bun install` and include the resulting `bun.lock` change.

`bun run doctor:oxy` is read-only. It fails CI when direct Oxy dependencies are
out of date or the lockfile contains duplicate Oxy versions. Neither CI nor the
application installs `latest` or modifies dependencies at runtime.
