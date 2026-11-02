type Callback = {
  (...args: unknown[]): void | Promise<void>;
  order?: number;
};

interface EventsMap {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [event: string]: any;
}

interface DefaultEvents {
  [event: string]: Callback;
}

export interface Unsubscribe {
  (): void;
}

/**
 * Typed event emitter with ordered listeners.
 *
 * Listeners run sequentially in ascending `order` (`order` defaults to `0`),
 * and `emit` awaits each listener before running the next one.
 *
 * @example
 * const emitter = createEvents<{ hello: (name: string) => void }>();
 * emitter.on("hello", (name) => console.log(name));
 * await emitter.emit("hello", "bean");
 */
export class Emitter<Events extends EventsMap = DefaultEvents> {
  events: Partial<{ [E in keyof Events]: Callback[] }> = {};

  on<K extends keyof Events>(event: K, cb: Events[K], order?: number): Unsubscribe {
    cb.order = order;
    const callbacks = this.events[event] ?? (this.events[event] = []);
    callbacks.push(cb);
    callbacks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return () => {
      this.events[event] = this.events[event]?.filter((x) => cb !== x);
    };
  }

  async emit<K extends keyof Events>(event: K, ...args: Parameters<Events[K]>): Promise<void> {
    const callbacks = this.events[event] ?? [];
    for (const cb of callbacks) {
      await cb(...args);
    }
  }
}

/**
 * Create a new {@link Emitter} instance.
 *
 * @example
 * const events = createEvents<{ hello: (name: string) => void }>();
 */
export function createEvents<T extends EventsMap = DefaultEvents>(): Emitter<T> {
  return new Emitter<T>();
}
