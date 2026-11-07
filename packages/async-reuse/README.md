# @beankit/async-reuse

Lightweight async operation deduplication and result reuse.

`async-reuse` prevents duplicate concurrent executions and reuses resolved results
within a configurable lifetime.

```bash
npm i @beankit/async-reuse
```

## API

```ts
import { AsyncReuse } from "@beankit/async-reuse";

const users = new AsyncReuse<User>();
const a = users.resolve(() => fetchUser(id), `user:${id}`);
const b = users.resolve(() => fetchUser(id), `user:${id}`);
// fetcher ran once; `a` settles with the execution's own outcome, `b` shares
// the tracked promise, so both resolve to the same value (a !== b).
```

The constructor takes an optional seed: `new AsyncReuse(value)` starts already
resolved with `value` (`null`/`undefined` mean empty).

| Member                                            | Description                                      |
| ------------------------------------------------- | ------------------------------------------------ |
| `resolve(fetcher, key?)`                          | Share an in-flight or fresh result; else execute |
| `forceResolve(fetcher, key?)`                     | Always execute, superseding tracked state        |
| `reset()`                                         | Drop tracked state; in-flight holders reject     |
| `value()`                                         | Latest settled value, or `null`; never throws    |
| `setDuration(ms)` / `setExpiresAt(ts)`            | Result lifetime (chainable)                      |
| `loading` / `resolved` / `rejected` / `completed` | Observable state                                 |

`AsyncReuseState` (`idle` / `loading` / `resolved` / `rejected`) is the exported enum
behind those getters.

## Rules

- One instance tracks one operation at a time. The same `key` shares a single
  execution; the starter gets a per-call promise and later callers share the
  tracked one, so they settle with the same value but are not the same object.
- A different `key` starts a new execution that supersedes the previous one.
  Superseded holders still settle with their own outcome, but they no longer
  drive instance state.
- A failure clears the tracked result, so the next `resolve` retries immediately.
- `reset()` rejects in-flight holders with an `AsyncReuseError` (`reason === "reset"`);
  a late settlement of the dropped execution is ignored and never overwrites new state.
- A result expires after `duration` milliseconds or at `expiresAt`, whichever
  hits first; the next `resolve` re-executes, and holders still in flight reject
  with an `AsyncReuseError` (`reason === "expired"`).
- `AsyncReuseError` carries a machine-readable `reason`, so an app can branch on it
  and translate the message instead of matching the English text.
- Dropped or unobserved failures never surface as unhandled rejections.

## Features

- Deduplicate concurrent operations by key
- Reuse resolved results
- Configurable expiration duration
- Absolute expiration timestamps
- Force execution and manual reset
- Observable execution states
- Zero runtime dependencies

## Design Principles

- Small and focused API
- Minimal dependencies
- Predictable lifecycle semantics
- Type-safe and framework-agnostic

Works in Node.js, the browser, and workers: no runtime dependencies, no platform APIs.
