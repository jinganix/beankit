import { describe, expect, it, vi } from "vitest";

import { createEvents, Emitter } from "./index";

describe("Emitter", () => {
  it("calls a listener with the emitted arguments", async () => {
    const emitter = new Emitter<{ test: (msg: string) => void }>();
    const handler = vi.fn();
    emitter.on("test", handler);

    await emitter.emit("test", "hello");

    expect(handler).toHaveBeenCalledWith("hello");
  });

  it("calls every listener of the same event", async () => {
    const emitter = new Emitter<{ test: () => void }>();
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    emitter.on("test", handler1);
    emitter.on("test", handler2);

    await emitter.emit("test");

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it("runs ordered listeners in ascending order", async () => {
    const emitter = new Emitter<{ test: () => void }>();
    const calls: number[] = [];
    emitter.on("test", () => void calls.push(2), 2);
    emitter.on("test", () => void calls.push(1), 1);
    emitter.on("test", () => void calls.push(3), 3);

    await emitter.emit("test");

    expect(calls).toEqual([1, 2, 3]);
  });

  it("treats listeners without order as 0", async () => {
    const emitter = new Emitter<{ test: () => void }>();
    const calls: string[] = [];
    emitter.on("test", () => void calls.push("ordered"), 1);
    emitter.on("test", () => void calls.push("plain"));

    await emitter.emit("test");

    expect(calls).toEqual(["plain", "ordered"]);
  });

  it("awaits async listeners before running the next one", async () => {
    const emitter = new Emitter<{ test: () => Promise<void> }>();
    const calls: string[] = [];
    emitter.on("test", async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      calls.push("first");
    });
    emitter.on("test", async () => void calls.push("second"));

    await emitter.emit("test");

    expect(calls).toEqual(["first", "second"]);
  });

  it("resolves when the event has no listeners", async () => {
    const emitter = new Emitter<{ test: () => void }>();

    await expect(emitter.emit("test")).resolves.toBeUndefined();
  });

  it("passes multiple arguments to listeners", async () => {
    const emitter = new Emitter<{ multi: (a: string, b: number, c: boolean) => void }>();
    const handler = vi.fn();
    emitter.on("multi", handler);

    await emitter.emit("multi", "text", 123, true);

    expect(handler).toHaveBeenCalledWith("text", 123, true);
  });

  it("removes only the unsubscribed listener", async () => {
    const emitter = new Emitter<{ test: () => void }>();
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    emitter.on("test", handler1);
    const unsubscribe = emitter.on("test", handler2);

    unsubscribe();
    await emitter.emit("test");

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).not.toHaveBeenCalled();
  });

  it("allows re-subscription after unsubscribe", async () => {
    const emitter = new Emitter<{ test: () => void }>();
    const handler = vi.fn();
    const unsubscribe = emitter.on("test", handler);

    unsubscribe();
    emitter.on("test", handler);
    await emitter.emit("test");

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("calls a twice-subscribed handler twice", async () => {
    const emitter = new Emitter<{ test: () => void }>();
    const handler = vi.fn();
    emitter.on("test", handler);
    emitter.on("test", handler);

    await emitter.emit("test");

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("ignores unsubscribe for an event with no listeners", async () => {
    const emitter = new Emitter<{ test: () => void }>();
    const handler = vi.fn();
    const unsubscribe = emitter.on("test", handler);

    unsubscribe();
    unsubscribe();
    await expect(emitter.emit("test")).resolves.toBeUndefined();
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("createEvents", () => {
  it("returns an Emitter instance", () => {
    expect(createEvents()).toBeInstanceOf(Emitter);
  });

  it("creates independent instances", async () => {
    const events1 = createEvents<{ test: () => void }>();
    const events2 = createEvents<{ test: () => void }>();
    const handler = vi.fn();
    events1.on("test", handler);

    await events2.emit("test");

    expect(handler).not.toHaveBeenCalled();
  });

  it("supports typed event payloads", async () => {
    const events = createEvents<{ custom: (data: { id: number }) => void }>();
    const handler = vi.fn();
    events.on("custom", handler);

    await events.emit("custom", { id: 1 });

    expect(handler).toHaveBeenCalledWith({ id: 1 });
  });
});
