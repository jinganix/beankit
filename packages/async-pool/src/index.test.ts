import { describe, expect, it, vi } from "vitest";

import { asyncPool } from "./index";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

describe("asyncPool", () => {
  it("rejects a non-positive or non-integer poolLimit", async () => {
    await expect(asyncPool(0, [1], async (n) => n)).rejects.toThrow(RangeError);
    await expect(asyncPool(-2, [1], async (n) => n)).rejects.toThrow(RangeError);
    await expect(asyncPool(1.5, [1], async (n) => n)).rejects.toThrow(RangeError);
  });

  it("resolves [] without calling iteratorFn for an empty list", async () => {
    const iteratorFn = vi.fn(async (n: number) => n);
    await expect(asyncPool(2, [], iteratorFn)).resolves.toEqual([]);
    expect(iteratorFn).not.toHaveBeenCalled();
  });

  it("keeps input order while respecting the concurrency limit", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const items = [1, 2, 3, 4, 5];
    const results = await asyncPool(2, items, async (n) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await sleep(30 - n * 5);
      inFlight -= 1;
      return n * 10;
    });
    expect(results).toEqual([10, 20, 30, 40, 50]);
    expect(maxInFlight).toBe(2);
  });

  it("runs sequentially with poolLimit 1", async () => {
    const seen: number[] = [];
    const results = await asyncPool(1, [1, 2, 3], async (n) => {
      seen.push(n);
      await sleep(5);
      return n * 2;
    });
    expect(results).toEqual([2, 4, 6]);
    expect(seen).toEqual([1, 2, 3]);
  });

  it("runs everything at once when poolLimit exceeds the list", async () => {
    const iteratorFn = vi.fn(async (n: number) => n * 2);
    await expect(asyncPool(10, [1, 2], iteratorFn)).resolves.toEqual([2, 4]);
    expect(iteratorFn).toHaveBeenCalledTimes(2);
  });

  it("accepts plain values from iteratorFn", async () => {
    await expect(asyncPool(2, [1, 2, 3], (n) => n + 1)).resolves.toEqual([2, 3, 4]);
  });

  it("rejects with the first error and starts no new tasks", async () => {
    const started: number[] = [];
    const iteratorFn = vi.fn(async (n: number) => {
      started.push(n);
      if (n === 1) {
        throw new Error("boom");
      }
      await sleep(20);
      return n;
    });
    await expect(asyncPool(2, [1, 2, 3], iteratorFn)).rejects.toThrow("boom");
    expect(started.sort()).toEqual([1, 2]);
    expect(iteratorFn).toHaveBeenCalledTimes(2);
  });

  it("rejects on a sync throw in iteratorFn", async () => {
    await expect(
      asyncPool(2, [1, 2], (n) => {
        if (n === 2) {
          throw new Error("sync boom");
        }
        return Promise.resolve(n);
      }),
    ).rejects.toThrow("sync boom");
  });
});
