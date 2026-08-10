# Inbox

**Inbox by Oxy** — the email client at [inbox.oxy.so](https://inbox.oxy.so).
Expo Router, web (static export → Cloudflare Pages) and Android.

Extracted from [OxyHQ/oxy](https://github.com/OxyHQ/oxy) (`packages/inbox`)
with its history intact.

## Getting started

```bash
bun install
bun run dev        # Expo dev server on port 8103 (press w for web)
bun run typecheck
bun run test       # jest — NOT `bun test`, which ignores jest.config.js
bun run build      # writes _headers, then `expo export --platform web`
```

The web build lands in `packages/frontend/dist`.

## There is no backend here

Mailboxes, threads, labels, filters, federation, SMTP and webhook ingest are all
`@oxyhq/api` in [OxyHQ/oxy](https://github.com/OxyHQ/oxy), served from
`api.oxy.so`. This repo is a client. Add an email capability there and consume it
through `@oxyhq/services` / `@oxyhq/core` — never a second copy.

## Configuration

Everything is `EXPO_PUBLIC_*` and is inlined into the bundle by Metro at build
time, so all three are public by construction. The committed defaults are
correct for production; override in `packages/frontend/.env` for a local or
staging target.

| Variable | Default |
|---|---|
| `EXPO_PUBLIC_API_URL` | `https://api.oxy.so` |
| `EXPO_PUBLIC_OXY_CLIENT_ID` | the registered production client id (`packages/frontend/constants/oxy.ts`) |
| `EXPO_PUBLIC_OXY_AUTH_REDIRECT_URI` | `https://inbox.oxy.so` |

## Layout

```
packages/
  frontend/    the app — Expo Router · NativeWind · @oxyhq/bloom · @oxyhq/services
```

## Licence

AGPL-3.0-only, unchanged from what it carried in OxyHQ/oxy. See `LICENSE`.
