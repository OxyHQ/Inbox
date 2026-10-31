import {
  applyQuarantinePlan,
  planLegacyMutationQuarantine,
  type SealedQuarantine,
} from '../../../../prototypes/legacyMutationQuarantine';

/** A model only: this map does not provide encryption or real crash durability. */
function fakeQuarantine(): SealedQuarantine & { copies: Map<string, string> } {
  const copies = new Map<string, string>();
  return {
    copies,
    async sealAndStore(raw) {
      const existing = [...copies].find(([, value]) => value === raw);
      if (existing) return existing[0];
      const receipt = `copy-${copies.size + 1}`;
      copies.set(receipt, raw);
      return receipt;
    },
    async open(receipt) {
      return copies.get(receipt) ?? null;
    },
  };
}

it('copies the full unowned blob and proposes removing mutations without assigning them', async () => {
  const original = JSON.stringify({
    buster: 'v',
    timestamp: 123,
    clientState: {
      queries: [{ queryKey: ['users'], state: { data: 'device query' } }],
      mutations: [
        {
          mutationKey: ['inbox', 'message', 'toggle-star'],
          state: { variables: { messageId: 'a' } },
        },
        { mutationKey: ['unknown'], state: { variables: { secret: 'private' } } },
      ],
    },
  });
  const sink = fakeQuarantine();
  const plan = await planLegacyMutationQuarantine(original, sink);
  expect(plan.kind).toBe('proposed-rewrite');
  if (plan.kind !== 'proposed-rewrite') throw new Error('missing plan');
  expect(sink.copies.get(plan.receipt)).toBe(original);
  expect(plan.expectedRaw).toBe(original);
  expect(JSON.parse(plan.replacementRaw)).toEqual({
    ...JSON.parse(original),
    clientState: { ...JSON.parse(original).clientState, mutations: [] },
  });
  expect(plan).not.toHaveProperty('accountId');
});

it('is idempotent when the sink provides atomic idempotent copies', async () => {
  const raw = JSON.stringify({
    clientState: { queries: [], mutations: [{ state: { variables: 'keep' } }] },
  });
  const sink = fakeQuarantine();
  const [first, second] = await Promise.all([
    planLegacyMutationQuarantine(raw, sink),
    planLegacyMutationQuarantine(raw, sink),
  ]);
  expect(first).toEqual(second);
  expect(sink.copies.size).toBe(1);
});

it.each(['write', 'verification'] as const)(
  'never produces a rewrite when %s fails',
  async (failure) => {
    const raw = JSON.stringify({ clientState: { mutations: [{ state: { variables: 'keep' } }] } });
    const sink: SealedQuarantine = {
      sealAndStore: async () => {
        if (failure === 'write') throw new Error('write failed');
        return 'id';
      },
      open: async () => 'wrong data',
    };
    await expect(planLegacyMutationQuarantine(raw, sink)).rejects.toThrow();
    expect(JSON.parse(raw).clientState.mutations).toHaveLength(1);
  },
);

it.each([
  'not-json',
  '{"clientState":{"mutations":"malformed"}}',
  '{"clientState":{"mutations":null}}',
  '{"clientState":{"queries":[]}}',
])('preserves an unreadable blob without proposing a rewrite', async (raw) => {
  const sink = fakeQuarantine();
  const plan = await planLegacyMutationQuarantine(raw, sink);
  expect(plan.kind).toBe('opaque');
  if (plan.kind !== 'opaque') throw new Error('missing receipt');
  expect(sink.copies.get(plan.receipt)).toBe(raw);
});

it.each([null, JSON.stringify({ clientState: { queries: ['keep'], mutations: [] } })])(
  'does nothing when there are no mutations',
  async (raw) => {
    const sink = fakeQuarantine();
    await expect(planLegacyMutationQuarantine(raw, sink)).resolves.toEqual({
      kind: 'nothing-to-copy',
    });
    expect(sink.copies.size).toBe(0);
  },
);

it('refuses a stale plan when another writer changed the shared blob', async () => {
  const original = JSON.stringify({
    clientState: { queries: [], mutations: [{ state: { variables: 'old' } }] },
  });
  const newer = JSON.stringify({
    clientState: { queries: [], mutations: [{ state: { variables: 'new' } }] },
  });
  const sink = fakeQuarantine();
  const plan = await planLegacyMutationQuarantine(original, sink);
  if (plan.kind !== 'proposed-rewrite') throw new Error('missing plan');
  let current = newer;
  const legacy = {
    compareAndReplace: async (expected: string, replacement: string) => {
      if (current !== expected) return false;
      current = replacement;
      return true;
    },
  };
  await expect(applyQuarantinePlan(plan, legacy, sink)).resolves.toBe(false);
  expect(current).toBe(newer);
  expect(sink.copies.get(plan.receipt)).toBe(original);
});

it('retains the exact quarantined bytes before and after a simulated commit', async () => {
  const original = JSON.stringify({
    clientState: { queries: [{ key: 'keep' }], mutations: [{ state: { variables: 'private' } }] },
  });
  const sink = fakeQuarantine();
  const plan = await planLegacyMutationQuarantine(original, sink);
  if (plan.kind !== 'proposed-rewrite') throw new Error('missing plan');
  let current = original;
  const legacy = {
    compareAndReplace: async (expected: string, replacement: string) => {
      if (current !== expected) return false;
      current = replacement;
      return true;
    },
  };
  expect(current).toBe(original); // A crash before the transaction keeps the source.
  await expect(applyQuarantinePlan(plan, legacy, sink)).resolves.toBe(true);
  expect(JSON.parse(current).clientState).toEqual({ queries: [{ key: 'keep' }], mutations: [] });
  expect(sink.copies.get(plan.receipt)).toBe(original);
  await expect(applyQuarantinePlan(plan, legacy, sink)).resolves.toBe(false);
});

it('never rewrites the source if the sealed copy disappears before commit', async () => {
  const original = JSON.stringify({
    clientState: { mutations: [{ state: { variables: 'private' } }] },
  });
  const sink = fakeQuarantine();
  const plan = await planLegacyMutationQuarantine(original, sink);
  if (plan.kind !== 'proposed-rewrite') throw new Error('missing plan');
  sink.copies.delete(plan.receipt);
  const legacy = { compareAndReplace: jest.fn(async () => true) };
  await expect(applyQuarantinePlan(plan, legacy, sink)).rejects.toThrow();
  expect(legacy.compareAndReplace).not.toHaveBeenCalled();
});

it('never touches registered account blobs when planning or applying the shared rewrite', async () => {
  const original = JSON.stringify({
    clientState: { queries: [], mutations: [{ mutationKey: ['unknown'] }] },
  });
  const entries = new Map([
    ['shared', original],
    ['account:alice', 'alice-paused-work'],
    ['account:bob', 'bob-paused-work'],
  ]);
  const sink = fakeQuarantine();
  const plan = await planLegacyMutationQuarantine(entries.get('shared') ?? null, sink);
  if (plan.kind !== 'proposed-rewrite') throw new Error('missing plan');
  const legacy = {
    compareAndReplace: async (expected: string, replacement: string) => {
      if (entries.get('shared') !== expected) return false;
      entries.set('shared', replacement);
      return true;
    },
  };
  await expect(applyQuarantinePlan(plan, legacy, sink)).resolves.toBe(true);
  expect(entries.get('account:alice')).toBe('alice-paused-work');
  expect(entries.get('account:bob')).toBe('bob-paused-work');
  expect(sink.copies.get(plan.receipt)).toBe(original);
});

it('permits only one atomic commit for concurrent identical plans', async () => {
  const original = JSON.stringify({
    clientState: { queries: [], mutations: [{ state: { variables: 'private' } }] },
  });
  const sink = fakeQuarantine();
  const plan = await planLegacyMutationQuarantine(original, sink);
  if (plan.kind !== 'proposed-rewrite') throw new Error('missing plan');
  let current = original;
  const legacy = {
    compareAndReplace: async (expected: string, replacement: string) => {
      if (current !== expected) return false;
      current = replacement;
      return true;
    },
  };
  expect(
    (
      await Promise.all([
        applyQuarantinePlan(plan, legacy, sink),
        applyQuarantinePlan(plan, legacy, sink),
      ])
    ).sort(),
  ).toEqual([false, true]);
  expect(sink.copies.get(plan.receipt)).toBe(original);
});
