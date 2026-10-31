# Account mutation migration audit

Inbox keeps its existing `INBOX_ACCOUNT_QUERIES` policy during the SDK 13.12.1
update. In particular, it does not enable `clearUnregisteredMutations` yet.
That option is not equivalent to cancelling a request or its callbacks.

## Offline operations

Inbox registers defaults and account-scoped persistence for ten mutation keys:
star, read, archive, delete, pin, message labels, snooze, unsnooze, bulk flags,
and bulk move. On reconnection, the app resumes paused mutations after its active
email API is available. The SDK update's migration test restores all ten from
Alice's account blob and exercises their actual Inbox defaults. It does not
prove that an operation whose only copy is in an older shared blob survives.

The option `clearUnregisteredMutations: true` prevents unregistered mutations
from being restored from or newly written to the shared cache. It also drops
all mutations found in a legacy shared blob during restore, including a now
registered mutation: that blob has no reliable account owner. The account blob
continues to restore registered paused mutations. Do not enable the option
until the fate of unowned queued work has been decided and tested.

An audit against the published SDK also found that, on an idle startup, the
old shared blob remains physically present after restore. A later cache change
causes a filtered snapshot to replace it. Skipping hydration alone is therefore
not an immediate physical deletion, and any storage failure must be handled
explicitly. These observations are not a claim that an automatic deletion is
safe or that old data is already gone.

## Separate migration design

A safe migration must preserve valid work without executing it as a different
account:

1. Inventory the legacy envelope and determine whether any historical format
   actually records a trustworthy owner. A message ID, the currently selected
   account, or access to a shared mailbox alone does not prove who queued it.
2. Quarantine records without provable ownership in device-protected storage;
   never execute or display their contents to whichever account signs in first.
   Preserve the source until the quarantine write is durable, and define an
   explicit retention and disposal policy before removing either copy.
3. Move only operations with proven ownership into that account's blob, with
   their registered keys and a replay/deduplication strategy. Restore and
   resume them only after that account and its API are ready.
4. Enable the stricter policy only after migration and failure handling are in
   place. A request already running still needs an account/session guard in the
   app; removing its mutation record does not stop its callbacks.

Verification must cover an old shared blob with both registered and unknown
operations, each of the ten registered defaults, A → B → A, process death
between each storage step, write/remove failures, and duplicate replay. A test
must show that no B session reads or runs A's data and that proven A operations
survive a restart. Unowned operations cannot be safely replayed automatically
without additional evidence of ownership.

## Session-owned optimistic mutations

Labels and templates bind each invocation to the API and SDK session epoch from
its originating React render. They verify ownership before and after cancelling
queries, before sending, and in completion callbacks. Rollback snapshots remain
in an in-memory WeakMap rather than mutation context. Consequently, the
internal template hooks now expose an undefined mutation context instead of the
previous `{ prev }`; their existing consumers do not read it. They continue to
accept the same mutation arguments and per-call callbacks, which are suppressed
when the originating session is no longer current.

This guards those two feature families only. It does not sanitize legacy
persisted mutation variables or results, fence other mutation hooks, cancel
requests already running, or change the persistence policy described above.
