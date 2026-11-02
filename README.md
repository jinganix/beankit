# beankit

Tiny, sharp open-source packages. One package does one job, with 100% test coverage.

## Packages

| Package                                              | Version | Purpose                                                  |
| ---------------------------------------------------- | ------- | -------------------------------------------------------- |
| [@beankit/all](packages/all)                         | 0.2.0   | All utilities in one treeshakable package                |
| [@beankit/url-join](packages/url-join)               | 0.2.0   | Join URL segments into one normalized URL                |
| [@beankit/event](packages/event)                     | 0.2.0   | Typed event emitter with ordering                        |
| [@beankit/async-reuse](packages/async-reuse)         | 0.2.0   | Deduplicate async operations, reuse results              |
| [@beankit/async-pool](packages/async-pool)           | 0.2.0   | Run async tasks with a concurrency limit                 |
| [@beankit/promise-timeout](packages/promise-timeout) | 0.2.0   | Race a promise against a timeout with fallback and abort |
| [@beankit/deferred](packages/deferred)               | 0.2.0   | Deferred promise backed by native Promise.withResolvers  |
| [@beankit/cbor](packages/cbor)                       | 0.1.1   | CBOR encode/decode, BigInt-free by default               |

Planned: `typing-event`, ...

## Quick start

```bash
npm i @beankit/all # everything, treeshakable — or one single-purpose package
```

```ts
import { urlJoin } from "@beankit/all";

urlJoin("http://api.test", "v1", "users"); // "http://api.test/v1/users"
```

## Develop

```bash
npm install
npm run check     # typecheck + lint + test (all workspaces)
npm run build
npm run check:packages  # verify publishable tarballs (needs dist/)
```

See [AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md).
