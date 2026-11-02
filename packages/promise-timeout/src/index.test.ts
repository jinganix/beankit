import { describe, expect, it, vi } from "vitest";

import { promiseTimeout, TimeoutError } from "./index";
import type { PromiseTimeoutOptions } from "./index";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const never = <T>(): Promise<T> => new Promise<T>(() => {});

describe("promiseTimeout", () => {
  it("exposes a TimeoutError for instance checking", () => {
    const error = new TimeoutError("slow");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(TimeoutError);
    expect(error.name).toBe("TimeoutError");
    expect(error.message).toBe("slow");
  });

  it("resolves with the input value when it settles first", async () => {
    const pending = promiseTimeout(
      sleep(10).then(() => "fast"),
      { milliseconds: 1000 },
    );
    expect(typeof pending.clear).toBe("function");
    await expect(pending).resolves.toBe("fast");
  });

  it("adopts a synchronously settling thenable", async () => {
    const sync = { then: (onFulfilled: (value: string) => void): void => onFulfilled("sync") };
    await expect(
      promiseTimeout(sync as unknown as PromiseLike<string>, { milliseconds: 20 }),
    ).resolves.toBe("sync");
  });

  it("rejects with a TimeoutError carrying the default message", async () => {
    const error = await promiseTimeout(never<string>(), { milliseconds: 10 }).catch(
      (error: unknown) => error,
    );
    expect(error).toBeInstanceOf(TimeoutError);
    expect((error as Error).message).toBe("Promise timed out after 10 milliseconds");
  });

  it("rejects with a TimeoutError for a custom string message", async () => {
    await expect(
      promiseTimeout(never<string>(), { milliseconds: 10, message: "too slow" }),
    ).rejects.toThrow(new TimeoutError("too slow"));
  });

  it("rejects with the same custom error instance", async () => {
    const custom = new TypeError("custom boom");
    const error = await promiseTimeout(never<string>(), {
      milliseconds: 10,
      message: custom,
    }).catch((error: unknown) => error);
    expect(error).toBe(custom);
  });

  it("resolves with undefined for message false", async () => {
    await expect(
      promiseTimeout(never<string>(), { milliseconds: 10, message: false }),
    ).resolves.toBeUndefined();
  });

  it("resolves with the fallback value on timeout", async () => {
    await expect(
      promiseTimeout(never<string>(), { milliseconds: 10, fallback: () => "fallback" }),
    ).resolves.toBe("fallback");
  });

  it("adopts a fallback promise on timeout", async () => {
    await expect(
      promiseTimeout(never<string>(), {
        milliseconds: 10,
        fallback: async () => "async fallback",
      }),
    ).resolves.toBe("async fallback");
  });

  it("rejects when the fallback throws", async () => {
    await expect(
      promiseTimeout(never<string>(), {
        milliseconds: 10,
        fallback: () => {
          throw new Error("fallback boom");
        },
      }),
    ).rejects.toThrow("fallback boom");
  });

  it("lets a fast input win over the fallback", async () => {
    await expect(
      promiseTimeout(
        sleep(5).then(() => "fast"),
        {
          milliseconds: 1000,
          fallback: () => "fallback",
        },
      ),
    ).resolves.toBe("fast");
  });

  it("rejects invalid milliseconds with a TypeError", async () => {
    for (const milliseconds of [0, -5, Number.NaN, "10"]) {
      await expect(
        promiseTimeout(Promise.resolve("sync"), {
          milliseconds: milliseconds as number,
        }),
      ).rejects.toThrow(TypeError);
    }
  });

  it("lets invalid options win over a synchronously settling input", async () => {
    const sync = { then: (onFulfilled: (value: string) => void): void => onFulfilled("sync") };
    await expect(
      promiseTimeout(sync as unknown as PromiseLike<string>, { milliseconds: 0 }),
    ).rejects.toThrow(TypeError);
  });

  it("rejects invalid customTimers with a TypeError", async () => {
    type Timers = PromiseTimeoutOptions<number>["customTimers"];
    const timers = { setTimeout, clearTimeout: undefined as unknown as typeof clearTimeout };
    await expect(
      promiseTimeout(Promise.resolve(1), {
        milliseconds: 10,
        customTimers: {} as unknown as Timers,
      }),
    ).rejects.toThrow(TypeError);
    await expect(
      promiseTimeout(Promise.resolve(1), { milliseconds: 10, customTimers: timers }),
    ).rejects.toThrow(TypeError);
  });

  it("never times out for Infinity or delays beyond the timer range", async () => {
    await expect(
      promiseTimeout(
        sleep(10).then(() => "late"),
        {
          milliseconds: Number.POSITIVE_INFINITY,
        },
      ),
    ).resolves.toBe("late");
    await expect(
      promiseTimeout(
        sleep(10).then(() => "late"),
        {
          milliseconds: 2 ** 31,
        },
      ),
    ).resolves.toBe("late");
  });

  it("rejects with the abort reason for an already aborted signal", async () => {
    const controller = new AbortController();
    controller.abort(new Error("already gone"));
    await expect(
      promiseTimeout(never<string>(), { milliseconds: 50, signal: controller.signal }),
    ).rejects.toThrow("already gone");
  });

  it("rejects with the abort reason when the signal aborts mid-flight", async () => {
    const controller = new AbortController();
    const pending = promiseTimeout(
      sleep(50).then(() => "slow"),
      {
        milliseconds: 1000,
        signal: controller.signal,
      },
    );
    controller.abort(new Error("stop now"));
    await expect(pending).rejects.toThrow("stop now");
  });

  it("rejects with the abort reason when a thenable aborts during subscribe", async () => {
    const controller = new AbortController();
    const sync = {
      then: (): void => {
        controller.abort(new Error("cancelled during then"));
      },
    };
    await expect(
      promiseTimeout(sync as unknown as PromiseLike<string>, {
        milliseconds: 20,
        signal: controller.signal,
      }),
    ).rejects.toThrow("cancelled during then");
  });

  it("rejects with an AbortError for a signal without a reason", async () => {
    let onAbort: (() => void) | undefined;
    const fake = {
      aborted: false,
      addEventListener: (_event: string, handler: () => void): void => {
        onAbort = handler;
      },
      removeEventListener: (): void => {},
    };
    const pending = promiseTimeout(never<string>(), {
      milliseconds: 20,
      signal: fake as unknown as AbortSignal,
    });
    onAbort?.();
    const error = await pending.catch((error: unknown) => error);
    expect(error).toBeInstanceOf(DOMException);
    expect((error as DOMException).name).toBe("AbortError");
  });

  it("calls cancel on the input when the timeout wins", async () => {
    const input = Object.assign(never<string>(), { cancel: vi.fn() });
    await expect(promiseTimeout(input, { milliseconds: 10 })).rejects.toThrow(TimeoutError);
    expect(input.cancel).toHaveBeenCalledTimes(1);
  });

  it("calls cancel on the input when the signal aborts", async () => {
    const controller = new AbortController();
    const input = Object.assign(never<string>(), { cancel: vi.fn() });
    const pending = promiseTimeout(input, { milliseconds: 1000, signal: controller.signal });
    controller.abort(new Error("stop now"));
    await expect(pending).rejects.toThrow("stop now");
    expect(input.cancel).toHaveBeenCalledTimes(1);
  });

  it("ignores a throwing cancel and still settles", async () => {
    const input = Object.assign(never<string>(), {
      cancel: (): void => {
        throw new Error("cannot stop");
      },
    });
    await expect(promiseTimeout(input, { milliseconds: 10 })).rejects.toThrow(TimeoutError);
  });

  it("clear prevents the timeout and is a no-op afterwards", async () => {
    const pending = promiseTimeout(
      sleep(20).then(() => "done"),
      { milliseconds: 10 },
    );
    pending.clear();
    await expect(pending).resolves.toBe("done");
    pending.clear();
    await expect(pending).resolves.toBe("done");
  });

  it("keeps the settled outcome when clearTimeout throws", async () => {
    const failing = (): void => {
      throw new Error("clear boom");
    };
    const timers = {
      setTimeout,
      clearTimeout: failing as unknown as typeof clearTimeout,
    };
    await expect(
      promiseTimeout(never<string>(), { milliseconds: 10, customTimers: timers }),
    ).rejects.toThrow(TimeoutError);

    const pending = promiseTimeout(never<string>(), { milliseconds: 10, customTimers: timers });
    expect(() => pending.clear()).toThrow("clear boom");
    await expect(pending).rejects.toThrow(TimeoutError);
  });

  it("rejects with the input error when the input settles first", async () => {
    const input = sleep(5).then(() => {
      throw new Error("input boom");
    });
    await expect(promiseTimeout(input, { milliseconds: 1000 })).rejects.toThrow("input boom");
  });

  it("swallows a late input rejection after the timeout wins", async () => {
    const input = new Promise<string>((_resolve, reject) => {
      setTimeout(() => reject(new Error("late boom")), 10);
    });
    await expect(promiseTimeout(input, { milliseconds: 5 })).rejects.toThrow(TimeoutError);
    await sleep(30);
  });

  it("observes an already rejected input for invalid options", async () => {
    const input = Promise.reject(new Error("input boom"));
    await expect(promiseTimeout(input, { milliseconds: 0 })).rejects.toThrow(TypeError);
  });
});
