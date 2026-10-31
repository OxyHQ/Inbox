# Legacy mutation quarantine — research prototype

This directory is **not wired to Inbox, OxyProvider, or either persister**. It
does not activate `clearUnregisteredMutations`. The functions model a possible
migration of the old shared query-cache blob; the current storage interfaces do
not yet meet their contract.

## What the model does

It makes no account inference. If the shared blob has mutations, it asks an
abstract sink to seal an exact, idempotent copy and reads it back before it
returns a proposed rewrite that preserves queries and empties only the shared
mutation array. The original remains untouched while planning. Malformed blobs
are copied opaquely and never rewritten. A separate function rechecks the copy
and delegates the rewrite to an **atomic** compare-and-replace supplied by the
caller. A changed source is not overwritten. Nothing is replayed or assigned to
an account; account-owned blobs are outside this interface.

The tests use in-memory fakes. They demonstrate sequencing and failure
behavior under the fakes' contracts, not encryption, actual durability, or
cross-process atomicity. Unknown-owner work remains in quarantine, not deleted.
The design does not promise that such work can be automatically replayed.

## Production blockers

- The quarantine sink must provide encrypted, durable, idempotent copies, a
  protected key, verification and a retention policy. Read-back alone cannot
  prove persistence across a power loss. Browser non-extractable keys do not
  protect against malicious code running in the same origin; native secure
  storage also has platform-specific size and availability limits. No adapter
  is chosen or implemented here.
- The shared-cache adapter must provide real compare-and-replace across all
  relevant processes/tabs. The current `StorageInterface` only offers get/set/
  remove; its web implementation can swallow write and remove failures. A
  read-then-write approximation is not atomic.
- A startup barrier must run before any SDK shared-cache writer or hydrator,
  and all older tabs/processes must be fenced from writing afterward. A CAS
  protects one transaction, but an old writer can otherwise reintroduce the
  blob after the transaction. Inbox currently supplies no such barrier.
- The SDK's opt-in policy does not cancel in-flight mutation callbacks and does
  not immediately rewrite an idle legacy shared blob. The ten registered Inbox
  mutation defaults and same-account account blobs need to remain intact.
- Unowned operations cannot be safely restored to a signed-in account merely
  because that account is active or can access a referenced message. An
  ownership proof and a replay/deduplication policy must be designed before any
  quarantined operation can run; until then, do not display or discard it.

Before any rollout, test the selected real adapters with process interruption at
every step, storage failures, competing tabs and old-version writers, A → B → A,
same-account offline replay, duplicate execution, and recovery of exact sealed
bytes. No production policy should be enabled on the evidence of this prototype
alone.

## Existing adapters checked

- Services 13.12.1 `createPlatformStorage` uses `localStorage` on web and
  AsyncStorage on native. Its interface has no compare-and-replace. The web
  wrapper catches and suppresses storage failures, so an awaited write is not
  evidence of a durable copy.
- Inbox's `utils/offlineQueue.ts` does use IndexedDB transactions, but for a
  separate legacy raw-fetch queue, not the SDK's localStorage cache key. It is
  explicitly not used for authenticated replay and its localStorage fallback
  silently ignores failures. It cannot atomically compare or replace the shared
  SDK blob and must not be reused as this migration adapter.
- `expo-secure-store` is installed, but it provides key/value secure storage,
  not a cross-store transaction that atomically moves the existing shared blob.
  No in-repository adapter was found that provides the complete required
  quarantine, atomic replacement and old-writer fencing contract.

A concrete next step is to design a shared SDK startup migration seam that runs
before persistence attaches, plus a platform-specific transactional store and
writer fencing protocol. The migration should stay off until those adapters are
implemented and exercised on real web and native storage.
