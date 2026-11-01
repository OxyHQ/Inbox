# Saved-search persistence boundaries

Inbox's saved-search query is one of the per-account roots persisted by Oxy
Services. The persisted record is a historical cache, not a guarantee that a
search still exists on the server. A write may already have committed while its
response or subsequent refresh is still pending. When an inactive query is
invalidated, its existing snapshot can be restored offline until a later
successful refresh.

New create and delete actions do not change the persisted query optimistically.
This prevents new pending actions from being serialized as if they were query
results. It does not sanitize older blobs: prior versions could persist a
pending create or a list missing a pending deletion, with no durable record of
the mutation. A prefix filter cannot reconstruct a missing deleted row. This
change adds no explicit migration or deletion of legacy blobs; the SDK's normal
snapshot writes and sign-out cleanup still apply.

## Why not move the root to memory-only?

Services 13.15.5 stores the roots in one per-subject blob. Simply declaring
`saved-searches` memory-only hides its old query during hydration, but does not
quarantine that data. The next snapshot of another root can overwrite the same
blob without the saved searches. Run this synthetic, in-memory reproduction
against the frozen dependencies:

```sh
node scripts/probes/saved-search-legacy-overwrite.cjs
```

It uses the actual Services persistence implementation and a real QueryClient,
but simulated storage and data; it does not exercise a device or modify a real
account. It verifies that the legacy query is absent after hydration and that a
subsequent flush overwrites the blob without it while keeping another root.

A data-preserving migration needs coordination with the SDK writer, durable
quarantine before any overwrite, crash/restart and concurrent-tab handling,
and a policy for restoration. The existing blob is scoped to the subject and
contains no verified actor binding. Neither a local epoch nor an unverified JWT
claim proves which actor may restore it. Until a subject/actor/context binding
and offline authorization policy exist, this change must not be described as
actor isolation or as a migration of legacy data.
