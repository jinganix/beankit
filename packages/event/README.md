# @beankit/event

Typed event emitter with ordered listeners and async emit.
Zero dependencies, works in Node.js, browsers, and workers (ships ESM, CJS, and types).

```bash
npm i @beankit/event
```

## API

```ts
import { createEvents, Emitter } from "@beankit/event";

const events = createEvents<{ hello: (name: string) => void }>();
const unsubscribe = events.on("hello", (name) => console.log(name), 1);
await events.emit("hello", "bean");
unsubscribe();
```

- `on(event, handler, order?)` registers a listener and returns an `unsubscribe`
  function. Listeners run in ascending `order` (`order` defaults to `0`).
- `emit(event, ...args)` awaits each listener sequentially before running the next
  one, and resolves when the event has no listeners.
- `createEvents<T>()` creates a new independent `Emitter<T>` instance.

## Rules

- Listeners run sequentially in ascending `order`; unordered listeners count as `0`.
- `emit` awaits async listeners, so a slow listener delays the ones after it.
- Unsubscribing removes only that subscription; other listeners keep working.
- A handler subscribed twice runs twice.
- Works in Node.js, the browser, and workers: no runtime dependencies, no platform APIs.
