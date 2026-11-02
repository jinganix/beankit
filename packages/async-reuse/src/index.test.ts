/// <reference types="node" />
import { describe, expect, it, vi } from "vitest";

import { AsyncReuse } from "./index";

function manual<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

describe("AsyncReuse", () => {
  it("dedupes concurrent calls with the same key into one execution", async () => {
    const reuse = new AsyncReuse<string>();
    const gate = manual<string>();
    const fetcher = vi.fn(() => gate.promise);

    const a = reuse.resolve(fetcher, "user:1");
    const b = reuse.resolve(fetcher, "user:1");

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(reuse.loading).toBe(true);

    gate.resolve("ada");
    await expect(a).resolves.toBe("ada");
    await expect(b).resolves.toBe("ada");
    expect(reuse.resolved).toBe(true);
    expect(reuse.completed).toBe(true);
  });

  it("reuses the resolved result within TTL with the same promise", async () => {
    const reuse = new AsyncReuse<string>().setDuration(10_000);
    const fetcher = vi.fn(async () => "ada");

    const a = await reuse.resolve(fetcher, "user:1");
    const b = reuse.resolve(fetcher, "user:1");
    const c = reuse.resolve(fetcher, "user:1");

    expect(a).toBe("ada");
    expect(b).toBe(c);
    await expect(b).resolves.toBe("ada");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await reuse.value()).toBe("ada");
  });

  it("lets a different key supersede without touching old holders", async () => {
    const reuse = new AsyncReuse<string>();
    const gateA = manual<string>();
    const gateB = manual<string>();

    const a = reuse.resolve(() => gateA.promise, "a");
    const b = reuse.resolve(() => gateB.promise, "b");
    expect(a).not.toBe(b);

    gateB.resolve("bee");
    await expect(b).resolves.toBe("bee");
    expect(reuse.key).toBe("b");

    // Late settlement of the superseded execution resolves its own holders
    // but never overwrites newer state.
    gateA.resolve("ay");
    await expect(a).resolves.toBe("ay");
    expect(reuse.key).toBe("b");
    expect(await reuse.value()).toBe("bee");
  });

  it("lets a superseded rejection settle its own holders only", async () => {
    const reuse = new AsyncReuse<string>();
    const gateA = manual<string>();
    const gateB = manual<string>();

    const a = reuse.resolve(() => gateA.promise, "a");
    const b = reuse.resolve(() => gateB.promise, "b");

    gateA.reject(new Error("old failed"));
    await expect(a).rejects.toThrow("old failed");

    gateB.resolve("bee");
    await expect(b).resolves.toBe("bee");
    expect(reuse.resolved).toBe(true);
    expect(await reuse.value()).toBe("bee");
  });

  it("retries after failure and reports value() as null", async () => {
    const reuse = new AsyncReuse<string>();
    const fetcher = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("recovered");

    await expect(reuse.resolve(fetcher, "k")).rejects.toThrow("boom");
    expect(reuse.rejected).toBe(true);
    expect(reuse.completed).toBe(true);
    expect(await reuse.value()).toBe(null);

    await expect(reuse.resolve(fetcher, "k")).resolves.toBe("recovered");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(reuse.resolved).toBe(true);
  });

  it("value() observed mid-flight resolves null when the fetch fails", async () => {
    const reuse = new AsyncReuse<string>();
    const gate = manual<string>();
    const pending = reuse.resolve(() => gate.promise, "k");
    const observed = reuse.value();

    gate.reject(new Error("boom"));
    await expect(pending).rejects.toThrow("boom");
    await expect(observed).resolves.toBe(null);
  });

  it("turns a synchronously throwing fetcher into a retryable rejection", async () => {
    const reuse = new AsyncReuse<string>();
    const fetcher = vi.fn<() => Promise<string>>(() => {
      throw new Error("sync boom");
    });

    await expect(reuse.resolve(fetcher, "k")).rejects.toThrow("sync boom");
    expect(reuse.rejected).toBe(true);

    fetcher.mockImplementation(async () => "recovered");
    await expect(reuse.resolve(fetcher, "k")).resolves.toBe("recovered");
  });

  it("ignores a throwing fetcher that already superseded itself", async () => {
    const reuse = new AsyncReuse<string>();
    const gate = manual<string>();
    const pending = reuse.resolve(() => {
      reuse.forceResolve(() => gate.promise, "inner");
      throw new Error("sync boom");
    }, "outer");

    await expect(pending).rejects.toThrow("sync boom");
    expect(reuse.loading).toBe(true);
    expect(reuse.key).toBe("inner");
    gate.resolve("in");
    await expect(reuse.value()).resolves.toBe("in");
  });

  it("reset rejects the in-flight holders and ignores late settlement", async () => {
    const reuse = new AsyncReuse<string>();
    const gateA = manual<string>();
    const old = reuse.resolve(() => gateA.promise, "a");

    reuse.reset();
    await expect(old).rejects.toThrow("AsyncReuse reset");
    expect(reuse.loading).toBe(false);
    expect(reuse.completed).toBe(false);
    expect(await reuse.value()).toBe(null);

    // Late settlement of the dropped execution changes nothing.
    gateA.resolve("stale");
    await sleep(0);
    expect(reuse.resolved).toBe(false);

    const gateB = manual<string>();
    const fresh = reuse.resolve(() => gateB.promise, "b");
    gateB.resolve("bee");
    await expect(fresh).resolves.toBe("bee");
    expect(reuse.key).toBe("b");
  });

  it("forceResolve bypasses the cache and supersedes in-flight work", async () => {
    const reuse = new AsyncReuse<string>();
    const fetcher = vi.fn(async () => "cached");
    await expect(reuse.resolve(fetcher, "k")).resolves.toBe("cached");

    fetcher.mockResolvedValueOnce("forced");
    await expect(reuse.forceResolve(fetcher, "k")).resolves.toBe("forced");
    expect(fetcher).toHaveBeenCalledTimes(2);

    const racing = new AsyncReuse<string>();
    const gateA = manual<string>();
    const gateB = manual<string>();
    const a = racing.resolve(() => gateA.promise, "k");
    const b = racing.forceResolve(() => gateB.promise, "k");
    expect(a).not.toBe(b);

    gateA.resolve("old");
    await expect(a).resolves.toBe("old");
    gateB.resolve("new");
    await expect(b).resolves.toBe("new");
    expect(await racing.value()).toBe("new");
  });

  it("re-executes after duration expires and keeps a future expiresAt", async () => {
    const reuse = new AsyncReuse<string>().setDuration(20);
    const fetcher = vi.fn(async () => "v1");
    await expect(reuse.resolve(fetcher, "k")).resolves.toBe("v1");

    // Expiring via duration must not clear an expiresAt still in the future.
    reuse.setExpiresAt(Date.now() + 10_000);
    await sleep(40);
    fetcher.mockResolvedValueOnce("v2");
    await expect(reuse.resolve(fetcher, "k")).resolves.toBe("v2");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(reuse.expiresAt).toBeGreaterThan(Date.now());
  });

  it("honors absolute expiresAt timestamps", async () => {
    const reuse = new AsyncReuse<string>();
    const fetcher = vi.fn(async () => "v1");
    await expect(reuse.resolve(fetcher, "k")).resolves.toBe("v1");

    reuse.setExpiresAt(Date.now() + 10_000);
    await expect(reuse.resolve(fetcher, "k")).resolves.toBe("v1");
    expect(fetcher).toHaveBeenCalledTimes(1);

    reuse.setExpiresAt(Date.now() - 1);
    fetcher.mockResolvedValueOnce("v2");
    await expect(reuse.resolve(fetcher, "k")).resolves.toBe("v2");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(reuse.expiresAt).toBe(0);
  });

  it("expires an idle instance that only carries a past expiresAt", async () => {
    const reuse = new AsyncReuse<string>();
    reuse.setExpiresAt(Date.now() - 1);
    const fetcher = vi.fn(async () => "v1");

    await expect(reuse.resolve(fetcher, "k")).resolves.toBe("v1");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("starts resolved from a constructor value and idle otherwise", async () => {
    const seeded = new AsyncReuse("ada");
    expect(seeded.resolved).toBe(true);
    expect(await seeded.value()).toBe("ada");

    const fetcher = vi.fn(async () => "bob");
    await expect(seeded.resolve(fetcher)).resolves.toBe("ada");
    expect(fetcher).not.toHaveBeenCalled();

    expect(new AsyncReuse(null).resolved).toBe(false);
    expect(new AsyncReuse().resolved).toBe(false);
    expect(await new AsyncReuse<string>().value()).toBe(null);
  });

  it("never surfaces unhandled rejections", async () => {
    const failures: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      failures.push(reason);
    };
    process.on("unhandledRejection", onUnhandled);
    try {
      // Dropped without any holder observing it.
      const dropped = new AsyncReuse<string>();
      dropped.resolve(() => sleep(5).then(() => "late"), "k");
      dropped.reset();

      // Failed without any holder observing it.
      const failed = new AsyncReuse<string>();
      failed.resolve(async () => {
        throw new Error("unobserved");
      }, "k");
      await sleep(0);
      await expect(failed.value()).resolves.toBe(null);

      // Expired cache rotation.
      const expiring = new AsyncReuse<string>().setDuration(5);
      await expiring.resolve(async () => "v1", "k");
      await sleep(20);
      await expiring.resolve(async () => "v2", "k");

      await sleep(20);
      expect(failures).toEqual([]);
    } finally {
      process.removeListener("unhandledRejection", onUnhandled);
    }
  });
});
