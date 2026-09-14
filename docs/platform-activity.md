# Static edge activity

The Inbox Worker observes static pages and assets through the shared edge publisher. Mailbox, SMTP and webhook activity belongs to the Oxy API; this repository has no backend.

Enable only the deployed Worker with private bindings `OXY_EDGE_ACTIVITY_ENABLED=true`, `OXY_EDGE_ACTIVITY_API_KEY`, `OXY_EDGE_ACTIVITY_API_SECRET`, and optional `OXY_EDGE_ACTIVITY_API_URL`. Credentials must never appear in Expo public variables or generated assets. Telemetry is disabled by default and publishing failures preserve the response and its stream.

Each request and response contributes a bounded operation with service, Cloudflare PoP, direction and category. No IPs, URLs, user IDs or payloads are published. A serving PoP is infrastructure metadata: external activity appears as a pulse, not an invented arc to a visitor location.

The Worker uses published `@oxy.so/telemetry@1.1.1`, pinned in `bun.lock`. Edge checks run with the frontend test command.
