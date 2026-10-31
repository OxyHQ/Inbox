/**
 * Research prototype only. It is not connected to OxyProvider or app storage.
 *
 * The caller must stop all writers before capturing the shared blob, and must
 * later use a genuinely atomic compare-and-replace to apply a proposed rewrite.
 * Neither property is supplied by Inbox's current storage adapter.
 */
export interface SealedQuarantine {
  /** Store the exact bytes encrypted, durably, and idempotently; do not log them. */
  sealAndStore(raw: string): Promise<string>;
  /** Verify the stored copy by decrypting it. */
  open(receipt: string): Promise<string | null>;
}

export type QuarantinePlan =
  | { kind: 'nothing-to-copy' }
  | { kind: 'opaque'; receipt: string }
  | { kind: 'proposed-rewrite'; receipt: string; expectedRaw: string; replacementRaw: string };

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Copy first; never change a source blob, infer an owner, or execute an operation. */
export async function planLegacyMutationQuarantine(
  raw: string | null,
  quarantine: SealedQuarantine,
): Promise<QuarantinePlan> {
  if (raw === null) return { kind: 'nothing-to-copy' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = undefined;
  }
  const state = record(parsed) && record(parsed.clientState) ? parsed.clientState : undefined;
  const mutations = state?.mutations;
  if (
    state &&
    (mutations === undefined ||
      mutations === null ||
      (Array.isArray(mutations) && mutations.length === 0))
  ) {
    return { kind: 'nothing-to-copy' };
  }

  const receipt = await quarantine.sealAndStore(raw);
  if ((await quarantine.open(receipt)) !== raw) {
    throw new Error('Quarantine copy could not be verified');
  }

  if (!state || !Array.isArray(mutations)) return { kind: 'opaque', receipt };
  state.mutations = [];
  return {
    kind: 'proposed-rewrite',
    receipt,
    expectedRaw: raw,
    replacementRaw: JSON.stringify(parsed),
  };
}

/** A real adapter must compare and replace in one atomic transaction. */
export interface AtomicLegacyBlob {
  compareAndReplace(expectedRaw: string, replacementRaw: string): Promise<boolean>;
}

/** Re-verify the copy and apply only if the legacy bytes have not changed. */
export async function applyQuarantinePlan(
  plan: Extract<QuarantinePlan, { kind: 'proposed-rewrite' }>,
  legacy: AtomicLegacyBlob,
  quarantine: SealedQuarantine,
): Promise<boolean> {
  if ((await quarantine.open(plan.receipt)) !== plan.expectedRaw) {
    throw new Error('Quarantine copy could not be verified');
  }
  return legacy.compareAndReplace(plan.expectedRaw, plan.replacementRaw);
}
