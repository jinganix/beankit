# beankit

Tiny, sharp open-source packages. One package does one job, with 100% test coverage.

## Packages

Packages publish independently; their versions live in each `package.json`.

| Package                                              | Purpose                                                  |
| ---------------------------------------------------- | -------------------------------------------------------- |
| [@beankit/all](packages/all)                         | All utilities in one treeshakable package                |
| [@beankit/url-join](packages/url-join)               | Join URL segments into one normalized URL                |
| [@beankit/event](packages/event)                     | Typed event emitter with ordering                        |
| [@beankit/async-reuse](packages/async-reuse)         | Deduplicate async operations, reuse results              |
| [@beankit/async-pool](packages/async-pool)           | Run async tasks with a concurrency limit                 |
| [@beankit/promise-timeout](packages/promise-timeout) | Race a promise against a timeout with fallback and abort |
| [@beankit/deferred](packages/deferred)               | Deferred promise backed by native Promise.withResolvers  |
| [@beankit/cbor](packages/cbor)                       | CBOR encode/decode, BigInt-free by default               |

Planned: `typing-event`, `replay`.

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
npm run check     # typecheck + lint + format + test (all workspaces)
npm run build
npm run check:packages  # verify publishable tarballs (needs dist/)
./scripts/setup-git-hooks.sh  # enable pre-commit / pre-push / commit-msg hooks
```

See [AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md).
