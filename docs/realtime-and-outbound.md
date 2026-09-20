# Realtime and outbound: the two things that looked fine and were not

> Both halves were fixed on 2026-09-19 (Inbox#34, OxyHQ/oxy#1343). This file is
> the evidence, so the same shapes are not rebuilt.

## New mail did not appear until the page was reloaded

`useInboxSocket` opened a **second** authenticated Socket.IO connection, beside
the one `SessionClient` already maintains in `@oxy.so/core`, behind a gate of
its own:

```ts
if (!userId || !activeSessionId || !canUsePrivateApi || !baseURL) return;
```

`activeSessionIdOf` returns `null` whenever the device-session state has not
loaded or the bound account carries no `sessionId` row on this device —
**independently of holding a valid bearer**. Nothing else in the app requires
it; `app/_layout.tsx` already writes `activeSessionId ?? user?.id ?? null`
because it knows the value can be absent while signed in. So on the web the
socket was frequently never created, and nothing said so: every diagnostic was
`__DEV__`, and `recordInboxMetric` dispatches a `CustomEvent` that nothing
subscribes to.

It now subscribes through `useOxyEvent`. **Do not reintroduce `io()` here.** The
SDK's connection is already authenticated, already reconnects, already re-binds
its listeners when the socket is recreated, and is gated on the right thing.

### `id` is not `messageId`

The server sends both, and they are different:

| field | what it is |
|---|---|
| `id` | the stored row's primary key — stable, and what dedupe compares |
| `messageId` | the RFC 5322 `Message-Id` header, as the sender wrote it |

They were once one field named `messageId` carrying the row id. A client
deduping an optimistic insert compared that against a persisted row's
`<…@oxy.so>` header, never matched, and every new mail rendered twice until the
reconciling refetch landed. Keep them apart.

### The polling is a net, not the mechanism

`useMessages` polls every 60 s and `useMailboxes` now does too, both with
`refetchIntervalInBackground: true`. React Query pauses intervals in a
backgrounded tab by default — which is exactly the tab a user returns to
expecting their mail. With a healthy socket this costs one cheap request a
minute; without one, the worst case is a minute rather than "until you reload".
A socket drops on suspend, on a network change and on every API rollout, so
that is a normal condition, not an exceptional one.

## Sending reported success for messages that never left

`POST /email/messages` answers 202 in two very different situations: the relay
took the message, or the relay refused it and the server parked it in the
durable outbox. The second is `{ queued: true }`.

It used to be treated as success — an info toast, the composer closing, and
`clearComposeRecovery()` deleting the local snapshot. With the relay
misconfigured **every** message took that branch, so a total outbound outage
looked like a working inbox.

`queued` now has its own callback. The composer still closes (the server holds
the message) but the crash-recovery snapshot survives, and `OutboundQueueBanner`
puts the delivery queue at the top of the inbox instead of leaving it three taps
deep in Settings → Advanced, hidden when empty.

The API distinguishes "will retry" from "will not": `terminal` on the outbox DTO
is true once the retry budget is spent or the failure was permanent. A
configuration error, a rejected credential and a 5xx refusal are all permanent
and are never queued — the API answers **503** with something actionable.

## Where outbound actually goes

Not here, and not settled. `oxy-api` relays through SES, which is still
sandboxed; the replacement relay, the Postfix MTA and the SES production-access
request all live in `~/Oxy/docs/outbound-mail-relay.md`. **A green Inbox does
not mean mail leaves the building** — check that runbook before believing a send
worked.
