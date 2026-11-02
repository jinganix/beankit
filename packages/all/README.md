# @beankit/all

All beankit utilities in one package: URL joining, typed events, async reuse, async pool, deferred promises, promise timeouts.
Zero dependencies, works in Node.js, browsers, and workers (ships ESM, CJS, and types).

```bash
npm i @beankit/all
```

```ts
import {
  urlJoin,
  createEvents,
  AsyncReuse,
  asyncPool,
  Deferred,
  promiseTimeout,
} from "@beankit/all";

urlJoin("http://api.test", "v1", "users"); // "http://api.test/v1/users"

const events = createEvents<{ hello: (name: string) => void }>();
events.on("hello", (name) => console.log(name));
await events.emit("hello", "bean");

const users = new AsyncReuse<User>();
const user = await users.resolve(() => fetchUser(id), `user:${id}`);

const avatars = await asyncPool(2, ids, (id) => fetchAvatar(id));
```

## API

| Export                                                     | What it does                                              | Standalone package         |
| ---------------------------------------------------------- | --------------------------------------------------------- | -------------------------- |
| `urlJoin(...parts)`                                        | Join URL segments into one normalized URL                 | `@beankit/url-join`        |
| `createEvents<T>()`, `Emitter`                             | Typed event emitter with ordered, awaited listeners       | `@beankit/event`           |
| `Unsubscribe`                                              | Function type returned by `Emitter.on`                    | `@beankit/event`           |
| `AsyncReuse`, `AsyncReuseState`                            | Deduplicate async operations, reuse results               | `@beankit/async-reuse`     |
| `asyncPool(poolLimit, items, fn)`                          | Run async tasks with a concurrency limit, ordered results | `@beankit/async-pool`      |
| `Deferred`                                                 | Deferred promise backed by native `Promise.withResolvers` | `@beankit/deferred`        |
| `promiseTimeout(promise, options)`, `TimeoutError`         | Race a promise against a timeout with fallback and abort  | `@beankit/promise-timeout` |
| `encodeCBOR`, `decodeCBOR`, `decodePartialCBOR`, `CBORTag` | CBOR codec, BigInt-free                                   | `@beankit/cbor`            |

Full rules and examples live in each standalone package README.

## BigInt

The main entry is BigInt-free: out-of-range integers decode to decimal strings
and the bundled code never touches the `BigInt` global, so it runs on runtimes
without BigInt. Native bigint support is a separate subpath, so importing it is
the only way BigInt code reaches your bundle:

```ts
import { decodeCBORWithBigInt, encodeCBORWithBigInt } from "@beankit/all/bigint";

decodeCBORWithBigInt(encodeCBORWithBigInt(2n ** 64n - 1n)); // 18446744073709551615n
```

## Notes

- **Treeshaking**: named exports plus `sideEffects: false`, so bundlers drop the
  helpers you don't import. Only need one helper? Install its standalone
  `@beankit/*` package instead for the smallest footprint.
- **TypeScript and JavaScript**: types ship inline (`dist/index.d.ts`); plain JS
  can `import` the ESM build or `require()` the CJS build with no extra setup.
- **Pick one**: use either `beankit` or the standalone `@beankit/*` packages in
  one app, not both — the bundle carries its own copies, so `instanceof` and
  caches are not shared across the two.
