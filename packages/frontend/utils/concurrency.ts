/**
 * Run `task` over `items`, at most `limit` at a time, and wait for all of
 * them; throws the first failure, in input order, once every one has settled.
 *
 * For actions the API has no bulk endpoint for (permanent delete, snooze): one
 * request per message, but never a whole conversation or selection at once —
 * a hundred simultaneous requests from one tab is a burst the API rate limits.
 */
export async function eachWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<unknown>,
): Promise<void> {
  const failures: { index: number; reason: unknown }[] = [];
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      try {
        await task(items[index]);
      } catch (reason) {
        failures.push({ index, reason });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  if (failures.length > 0) throw failures.sort((a, b) => a.index - b.index)[0].reason;
}

/** How many per-message requests a bulk action keeps in flight. */
export const PER_MESSAGE_CONCURRENCY = 4;
