# @beankit/async-pool

Run async tasks over a list with a concurrency limit, collecting ordered results.
Zero dependencies, works in Node.js, browsers, and workers (ships ESM, CJS, and types).

```bash
npm i @beankit/async-pool
```

## API

```ts
import { asyncPool } from "@beankit/async-pool";

asyncPool(poolLimit, items, iteratorFn): Promise<R[]>;
```

- `poolLimit`: max executions in flight; must be a positive integer.
- `items`: readonly input list.
- `iteratorFn(item, index)`: task for one item; may return a promise or a plain value.

## Usage

```ts
import { asyncPool } from "@beankit/async-pool";

const users = await asyncPool(2, ids, (id) => fetchUser(id));
// at most 2 fetches in flight, users[0] matches ids[0]
```

## Rules

- At most `poolLimit` tasks run at the same time.
- Results keep input order, even when later tasks finish first.
- A non-positive or non-integer `poolLimit` throws a `RangeError`.
- An empty list resolves to `[]` without calling `iteratorFn`.
- A sync throw in `iteratorFn` rejects like an async failure.
- The first failure rejects the returned promise; already-started tasks run
  to completion, but no new tasks start afterwards.

Works in Node.js, the browser, and workers: no runtime dependencies, no platform APIs.
