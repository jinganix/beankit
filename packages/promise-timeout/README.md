# @beankit/promise-timeout

Race a promise against a timeout. The loser is observed but ignored, the timer
and abort listener clean themselves up, and a cancelable input is stopped.
Zero dependencies, works in Node.js, browsers, and workers (ships ESM, CJS, and types).

```bash
npm i @beankit/promise-timeout
```

## API

```ts
import { promiseTimeout, TimeoutError } from "@beankit/promise-timeout";

const user = await promiseTimeout(fetchUser(id), { milliseconds: 2000 });
const pending = promiseTimeout(fetchUser(id), { milliseconds: 2000 });
pending.clear(); // give up on timing out; the input still settles
```

- `promiseTimeout(input, options)` returns the input decorated with a timeout
  and a `.clear()` method that disarms it.
- `TimeoutError` is thrown on timeout by default; check it with `instanceof`.

| Option         | Type                            | Purpose                                                                                                    |
| -------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `milliseconds` | `number`                        | Timeout delay. `Infinity` (or above `2 ** 31 - 1`) never fires.                                            |
| `message`      | `string \| Error \| false`      | Custom failure: string becomes a `TimeoutError`, an `Error` is thrown as-is, `false` resolves `undefined`. |
| `fallback`     | `() => value \| Promise<value>` | Settle with something else instead of failing on timeout.                                                  |
| `signal`       | `AbortSignal`                   | Reject with the abort reason when the signal aborts.                                                       |
| `customTimers` | `{ setTimeout, clearTimeout }`  | Timer implementations, e.g. to dodge fake timers in tests.                                                 |

## Rules

- The first settler wins; the loser is still observed, so a late input
  rejection never escapes as an unhandled rejection.
- Invalid options and an already-aborted signal reject before the input is
  even subscribed, so they win over synchronously settling inputs.
- The abort listener attaches before subscribing to the input, so a signal
  aborted from inside a synchronous `then` is still honored.
- A timed-out or aborted input with a `.cancel()` method gets it called
  (best effort: a throwing `.cancel()` is ignored and the outcome stands).
- Settling removes the timer and the abort listener automatically; a failing
  cleanup step never changes the outcome.
- Timer functions are called detached, so `this`-sensitive custom timers work.
