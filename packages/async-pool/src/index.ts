/**
 * Run `iteratorFn` over `items` with at most `poolLimit` executions in flight.
 *
 * Results keep input order regardless of completion order. Already-started
 * executions run to completion, but once one rejects no new executions start
 * and the returned promise rejects with the first error.
 *
 * @example
 * const ids = [1, 2, 3, 4];
 * const users = await asyncPool(2, ids, (id) => fetchUser(id));
 * // at most 2 fetches in flight, users[0] matches ids[0]
 */
export async function asyncPool<T, R>(
  poolLimit: number,
  items: readonly T[],
  iteratorFn: (item: T, index: number) => Promise<R> | R,
): Promise<R[]> {
  if (!Number.isInteger(poolLimit) || poolLimit < 1) {
    throw new RangeError(`poolLimit must be a positive integer, got ${poolLimit}`);
  }
  const results = new Array<R>(items.length);
  if (items.length === 0) {
    return results;
  }

  let next = 0;
  let failed = false;

  async function worker(): Promise<void> {
    while (next < items.length && !failed) {
      const index = next;
      next += 1;
      try {
        results[index] = await iteratorFn(items[index] as T, index);
      } catch (err) {
        failed = true;
        throw err;
      }
    }
  }

  const workers: Array<Promise<void>> = [];
  const count = Math.min(poolLimit, items.length);
  for (let i = 0; i < count; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}
