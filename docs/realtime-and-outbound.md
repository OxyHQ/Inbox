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

`POST /email/messages` used to relay inside the request and answer 202 in two
very different situations: the relay took the message, or it refused and the
server parked it in an outbox (`{ queued: true }`). The second was treated as
success, so a total outbound outage looked like a working inbox. And because
the relay ran inside the request, a relay slower than the client's timeout made
the client report a failure while the server was still sending, and the user
pressed Send again.

Since OxyHQ/oxy#1662 (2026-10) a send is **filed first and delivered
afterwards** (`packages/api/src/services/emailDelivery.service.ts`):

- The API claims the message's `email_outbox` row, files it in Sent linked to
  that row, and answers 202 with `id` (the Sent row) and `delivery` — normally
  `sending`. It never waits on SMTP, so the client needs no long timeout, and
  `retry` is safe because the Idempotency-Key makes a repeat the same message.
  Only "no relay configured at all" (503) and a refused recipient (400) still
  fail the request itself.
- The outbox row IS the delivery; there is no second table. Every message read
  carries `delivery` (`@oxy.so/contracts` `emailMessageDeliverySchema`):
  `sending`, `retrying` (with `nextAttemptAt`), `sent`, or `failed`, with the
  relay's own words in `error` and a typed `errorCode` (`relay_unavailable`,
  `relay_unconfigured`, `relay_auth`, `rejected`, `retries_exhausted`,
  `bounced`, `cancelled`). An SES permanent bounce turns a `sent` message into
  `failed`/`bounced`. Each change emits `email:changed` with reason `delivery`.
- `POST /email/messages/:id/delivery/retry` tries again with a fresh budget. It
  is refused for a recipient suppressed since, which is why a bounce offers only
  **Edit as new** (`canRetry` in `utils/delivery.ts`).
- The client shows it where the message is: a chip on the Sent row and the
  delivery label in place of the time in a conversation (`useDeliveryLabel`), a
  notice with **Retry** and **Edit as new** on the message (`DeliveryNotice`),
  `UndeliveredBanner` at the top of the inbox, and a toast on any `failed`
  transition wherever the user is (`useInboxSocket`).

It degrades to nothing: received mail and mail sent before delivery was tracked
have no `delivery` and read as delivered; an `errorCode` this client does not
know parses as `null` (the relay's words are still shown), and a `delivery` it
cannot parse is dropped rather than dropping the message.

There is no separate "delivery queue" in the app any more — the Sent message
IS the queue entry. Do not reintroduce `queued`: the server sends it only for
older clients, true only when an earlier attempt under the same key failed, and
the message's own `delivery` already says so.

## Where outbound actually goes

Not here, and not settled. `oxy-api` relays through SES, which is still
sandboxed; the replacement relay, the Postfix MTA and the SES production-access
request all live in `~/Oxy/docs/outbound-mail-relay.md`. **A green Inbox does
not mean mail leaves the building** — check that runbook before believing a send
worked.
