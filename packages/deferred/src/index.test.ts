import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Deferred } from "./index";

type NativeWithResolvers = <T>() => {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

const holder = Promise as unknown as { withResolvers?: NativeWithResolvers };
const native = holder.withResolvers;

afterEach(() => {
  holder.withResolvers = native;
});

describe("Deferred", () => {
  it("exposes a promise with resolve and reject", () => {
    const deferred = new Deferred();
    expect(deferred.promise).toBeInstanceOf(Promise);
    expect(typeof deferred.resolve).toBe("function");
    expect(typeof deferred.reject).toBe("function");
  });

  it("resolves with a value", async () => {
    const deferred = new Deferred<string>();
    deferred.resolve("success");
    await expect(deferred.promise).resolves.toBe("success");
  });

  it("resolves with a thenable", async () => {
    const deferred = new Deferred<string>();
    deferred.resolve(Promise.resolve("async"));
    await expect(deferred.promise).resolves.toBe("async");
  });

  it("rejects with a reason", async () => {
    const deferred = new Deferred<string>();
    deferred.reject(new Error("test error"));
    await expect(deferred.promise).rejects.toThrow("test error");
  });

  it("resolves with no value by default", async () => {
    const deferred = new Deferred();
    deferred.resolve();
    await expect(deferred.promise).resolves.toBeUndefined();
  });

  it("allows multiple awaits on the same promise", async () => {
    const deferred = new Deferred<number>();
    deferred.resolve(42);
    await expect(deferred.promise).resolves.toBe(42);
    await expect(deferred.promise).resolves.toBe(42);
  });

  it("resolves asynchronously", async () => {
    const deferred = new Deferred<string>();
    setTimeout(() => {
      deferred.resolve("async value");
    }, 10);
    await expect(deferred.promise).resolves.toBe("async value");
  });

  it("uses Promise.withResolvers when available", async () => {
    let calls = 0;
    holder.withResolvers = <T>(): {
      promise: Promise<T>;
      resolve: (value: T | PromiseLike<T>) => void;
      reject: (reason?: unknown) => void;
    } => {
      calls += 1;
      let resolve!: (value: T | PromiseLike<T>) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };

    const deferred = new Deferred<string>();
    expect(calls).toBe(1);
    deferred.resolve("native");
    await expect(deferred.promise).resolves.toBe("native");
  });
});

describe("Deferred without Promise.withResolvers", () => {
  beforeEach(() => {
    holder.withResolvers = undefined;
  });

  it("exposes a promise with resolve and reject", () => {
    const deferred = new Deferred();
    expect(deferred.promise).toBeInstanceOf(Promise);
    expect(typeof deferred.resolve).toBe("function");
    expect(typeof deferred.reject).toBe("function");
  });

  it("resolves with a value", async () => {
    const deferred = new Deferred<string>();
    deferred.resolve("fallback");
    await expect(deferred.promise).resolves.toBe("fallback");
  });

  it("resolves with a thenable", async () => {
    const deferred = new Deferred<string>();
    deferred.resolve(Promise.resolve("fallback async"));
    await expect(deferred.promise).resolves.toBe("fallback async");
  });

  it("rejects with a reason", async () => {
    const deferred = new Deferred<string>();
    deferred.reject(new Error("fallback error"));
    await expect(deferred.promise).rejects.toThrow("fallback error");
  });

  it("resolves with no value by default", async () => {
    const deferred = new Deferred();
    deferred.resolve();
    await expect(deferred.promise).resolves.toBeUndefined();
  });

  it("keeps instances independent", async () => {
    const first = new Deferred<string>();
    const second = new Deferred<string>();
    first.resolve("first");
    second.reject(new Error("second"));
    await expect(first.promise).resolves.toBe("first");
    await expect(second.promise).rejects.toThrow("second");
  });
});
