import { describe, expect, it } from "vitest";

import {
  AsyncReuse,
  AsyncReuseState,
  asyncPool,
  createEvents,
  decodeCBOR,
  Deferred,
  Emitter,
  encodeCBOR,
  promiseTimeout,
  urlJoin,
} from "./index";
import type { Unsubscribe } from "./index";

describe("beankit", () => {
  it("re-exports urlJoin", () => {
    expect(urlJoin("http://api.test", "v1", "users")).toBe("http://api.test/v1/users");
  });

  it("re-exports the event emitter", async () => {
    const events = createEvents<{ hello: (name: string) => void }>();
    expect(events).toBeInstanceOf(Emitter);
    const seen: string[] = [];
    const unsubscribe: Unsubscribe = events.on("hello", (name) => {
      seen.push(name);
    });
    await events.emit("hello", "bean");
    unsubscribe();
    await events.emit("hello", "ignored");
    expect(seen).toEqual(["bean"]);
  });

  it("re-exports async reuse", async () => {
    expect(AsyncReuseState.idle).toBe("idle");
    const users = new AsyncReuse<string>();
    const started = users.resolve(async () => "bean", "user:1");
    const joined = users.resolve(async () => "other", "user:1");
    expect(joined).not.toBe(started);
    await expect(started).resolves.toBe("bean");
    await expect(joined).resolves.toBe("bean");
  });

  it("re-exports async pool", async () => {
    await expect(asyncPool(2, [1, 2, 3], async (n) => n * 2)).resolves.toEqual([2, 4, 6]);
  });

  it("re-exports deferred", async () => {
    const gate = new Deferred<string>();
    gate.resolve("bean");
    await expect(gate.promise).resolves.toBe("bean");
  });

  it("re-exports promise timeout", async () => {
    await expect(
      promiseTimeout(new Promise<string>(() => {}), { milliseconds: 1 }),
    ).rejects.toThrow();
  });

  it("re-exports the cbor codec", () => {
    expect(decodeCBOR(encodeCBOR("bean"))).toBe("bean");
  });
});
