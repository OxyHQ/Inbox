# Inbosh

Email client at inbo.sh: Expo Router app, web (Cloudflare Worker `oxy-inbox`) + Android.

## Commands

```bash
bun install
bun run dev          # Expo start (web: bun run web, android: bun run android)
bun run test         # jest + worker tests
bun run lint         # Biome + Expo ESLint (lint:fix to write)
bun run typecheck
bun run build        # expo export, web
```

## Map

- `packages/frontend/`: the app; `packages/frontend/wrangler.toml`: the Worker
- `docs/`: design notes; reasons for the rules below: `docs/agent-rules.md`

## Conventions

- Client only: mailbox, SMTP and federation logic live in OxyHQ/oxy; origins named there stay.
- `linker = "hoisted"` stays in `bunfig.toml`; isolated linking drops SDK CSS silently.
- `bun run test`, never `bun test` (refused by `bunfig.toml`).
- No `catalog:` or `workspace:*` specifiers; commit `bun.lock` with any `package.json` change.
- Import `@oxy.so/services/ui/client`, not the root barrel (first-paint cost).
- One `OxyProvider`; sign-in is `OxyAccountDialog`, never a redirect.
- Config from `@oxy.so/app-preset`; fix the preset upstream.
- Bloom tokens + NativeWind only; no hardcoded brand colours.
- Realtime via `useOxyEvent`; never a second `io()`.

## Boundaries

- Never prune a dependency from a zero-import census; 48 have no imports by design.
- Never "clean up" Inbox origins in OxyHQ/oxy; removal causes an outage.
- Ask first before changing legacy mutation handling: `docs/legacy-mutation-quarantine.md`.

## Testing

Run `bun run typecheck` and `bun run test`; `expo export` ignores type errors,
so typecheck is the gate. Done = lint, typecheck and test green.

## PR and commits

- Run `bun run validate:agents-md`; AGENTS.md has a 4 KB budget, so move detail to `docs/`.
- Run `bun run doctor:oxy` after dependency changes.

## Secrets

Never print env or token values; deploy secrets live in GitHub Actions and Cloudflare.

## Links

- [Agent rules](./docs/agent-rules.md), [dependencies](./docs/dependencies.md), [realtime](./docs/realtime-and-outbound.md), [legacy mutation quarantine](./docs/legacy-mutation-quarantine.md)
- [Oxy standards](https://github.com/OxyHQ/oxy/blob/main/docs/engineering/standards.md), [lint and format](https://github.com/OxyHQ/oxy/blob/main/docs/engineering/lint-and-format.md), [build traps](https://github.com/OxyHQ/oxy/blob/main/docs/engineering/build-and-runtime-traps.md), [npm releases](https://github.com/OxyHQ/oxy/blob/main/docs/npm-releases.md)

Owner: Nate Isern (Oxy). Last reviewed: 2026-11-11.
