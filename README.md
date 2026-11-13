# Inbox

**Inbosh by Oxy** — the email client at [inbo.sh](https://inbo.sh).
Expo Router, web (static export → a Cloudflare Worker) and Android.

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
`@oxy.so/api` in [OxyHQ/oxy](https://github.com/OxyHQ/oxy), served from
`api.oxy.so`. This repo is a client. Add an email capability there and consume it
through `@oxy.so/services` / `@oxy.so/core` — never a second copy.

## AI routing

Inbox keeps product inference and agent conversation separate:

- Compose assistance, daily brief, natural-language search, smart replies and
  thread summaries call the authenticated `/email/ai/*` routes on Oxy. Oxy
  bounds the data and prompt and executes it through Kaana at the `instant`
  power level (routing profile `power-instant`, the cheapest), which Oxy owns:
  this client never sends a model or routing profile. The concrete model that
  ran is recorded by Oxy, not returned to the app.
- “Ask Alia” and voice remain Alia agent capabilities through
  `@gemies/sdk` and `https://api.gemies.ai`; they do not use the removed
  Oxy-to-Alia completion proxy.

No provider credential belongs in this app or its environment. Hosted provider
keys are encrypted in Kaana's PostgreSQL/KMS-backed credential store.

## Configuration

Everything is `EXPO_PUBLIC_*` and is inlined into the bundle by Metro at build
time, so all four are public by construction. The committed defaults are
correct for production; override in `packages/frontend/.env` for a local or
staging target.

| Variable                            | Default                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL`               | `https://api.oxy.so`                                                          |
| `EXPO_PUBLIC_GEMIES_API_URL`        | `https://api.gemies.ai` (set in `deploy.yml` and `eas.json`; read by the SDK) |
| `EXPO_PUBLIC_OXY_CLIENT_ID`         | the registered production client id (`packages/frontend/constants/oxy.ts`)    |
| `EXPO_PUBLIC_OXY_AUTH_REDIRECT_URI` | `https://inbo.sh`                                                             |

## Layout

```
packages/
  frontend/    the app — Expo Router · NativeWind · @oxy.so/bloom · @oxy.so/services
```

## Licence

AGPL-3.0-only, unchanged from what it carried in OxyHQ/oxy. See `LICENSE`.
