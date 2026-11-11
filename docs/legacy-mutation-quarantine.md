# Legacy shared mutation data: quarantine proposal

Status: proposal, not implemented. Nothing in this document is wired into Inbox
or the Oxy Services SDK, and `clearUnregisteredMutations` stays off. The
application-specific mutation audit is
[account-mutation-migration.md](account-mutation-migration.md). A standalone
model of the algorithm, with in-memory fakes, is kept on the archived branch
[`archive/sweep-20261106/wt-inbox-legacy-quarantine-prototype`](https://github.com/OxyHQ/Inbox/tree/archive/sweep-20261106/wt-inbox-legacy-quarantine-prototype).
It is a review artifact, not evidence that the migration is production-ready.

## What is observed

- The legacy shared TanStack Query blob can contain mutation variables, results
  and other account-private state. Updating the SDK does not sanitize it.
- `clearUnregisteredMutations` (Services `AccountQueriesConfig`) filters
  unregistered mutations out of persistence and clears them on account
  transitions. It does not cancel callbacks already running; the app must also
  guard results and callbacks by session ownership.
- A legacy shared blob has no reliable account owner. Assigning its mutations to
  the current account, or inferring ownership from message IDs or mailbox
  access, risks replaying one person's operation as another. Discarding them
  silently risks losing legitimate offline work.
- The account-owned path is different: the ten registered paused message
  operations restore and resume from an account's own blob. That must keep
  working after any migration.
- On an idle startup the old shared blob stays physically present after restore;
  a later cache event rewrites it with a filtered snapshot. Skipping hydration is
  therefore not deletion, and removal after startup, a write failure or process
  termination is not established.

## Safety contract

1. Before the SDK hydrator or persistence writer starts, fence every writer,
   including older app processes and web tabs. Capture the exact legacy bytes
   without printing private data.
2. Copy the whole original blob into a durable encrypted quarantine with
   protected keys and idempotent writes. Verify by reading back and decrypting;
   readback alone does not prove durability across power loss. A malformed or
   unrecognized blob, including a missing or null mutation field, stays opaque
   and is not rewritten.
3. Only after the verified copy exists, atomically compare the source with the
   captured bytes and replace it with a version that keeps metadata and queries
   but drops the shared mutations. If the comparison or storage fails, leave the
   source intact and retry safely. Account-owned blobs are never rewritten.
4. Do not attribute, replay, expose or delete quarantined operations until a
   separate design settles provenance, user consent, retention and recovery.
   Replay must be idempotent and preserve the registered offline operations.

## Why it cannot ship yet

The SDK's `StorageInterface` is `getItem`/`setItem`/`removeItem`/`clear`, with no
atomic compare-and-replace across processes or tabs; the web storage wrapper
also swallows failures, so callers cannot rely on a verified write. Expo
SecureStore offers key/value storage with payload-size limits, not a
cross-store transaction or fencing. A real design needs:

- a platform-specific encrypted quarantine and key lifecycle;
- crash durability, and a transaction or proven compare-and-replace over the
  source;
- a startup barrier that also stops old-version writers from reintroducing the
  blob.

Web encryption cannot defend against malicious JavaScript in the same origin.
Without these pieces, enabling the policy would leave legacy data behind in some
cases and strand operations of unknown ownership.

## Verification before activation

- Real native and web adapters; quota, write and read failures; interruption at
  every step; idempotent retries; competing tabs and processes; an old-version
  writer after migration.
- A to B to A, sign-out and session replacement, idle startup and later
  persistence events, with the real SDK packages. Quarantined bytes never hydrate
  under another account, and physical-source cleanup is reported truthfully.
- All registered account-owned paused operations survive and resume exactly once;
  shared operations of unknown owner are retained with no automatic attribution
  or replay. Retention and recovery are specified before disposal is enabled.
- A security, privacy and operations review, then the SDK startup hook and app
  adoption introduced together behind an explicit rollout and recovery plan.
