# @beankit/deferred

A promise with `resolve`/`reject` detached from its executor. Uses native
`Promise.withResolvers` when available, with a built-in fallback for older
runtimes. Zero dependencies, works in Node.js, browsers, and workers (ships
ESM, CJS, and types).

```bash
npm i @beankit/deferred
```

## API

```ts
import { Deferred } from "@beankit/deferred";

const gate = new Deferred<string>();
gate.resolve("go");
await gate.promise; // "go"
```

- `new Deferred<T>()` creates `{ promise, resolve, reject }`. `resolve`
  accepts plain values and thenables, matching `Promise.withResolvers`.
- Defaults to `Deferred<void>` for signal-style gates: `gate.resolve()`.
