import { eachWithConcurrency } from '@/utils/concurrency';

it('keeps at most the limit in flight, and runs every item', async () => {
  let inFlight = 0;
  let peak = 0;
  const done: number[] = [];
  await eachWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4, async (n) => {
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await new Promise((resolve) => setTimeout(resolve, n % 3));
    inFlight -= 1;
    done.push(n);
  });
  expect(peak).toBe(4);
  expect(done.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

it('runs every item even when one fails, then throws the first failure', async () => {
  const done: number[] = [];
  await expect(
    eachWithConcurrency([1, 2, 3, 4], 2, async (n) => {
      if (n === 2 || n === 4) throw new Error(`failed ${n}`);
      done.push(n);
    }),
  ).rejects.toThrow('failed 2');
  expect(done).toEqual([1, 3]);
});
