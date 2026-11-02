# @beankit/url-join

Join URL path segments, query strings, and hash fragments into a single normalized URL.
Zero dependencies, works in Node.js, browsers, and workers (ships ESM, CJS, and types).

```bash
npm i @beankit/url-join
```

## API

```ts
import { urlJoin } from "@beankit/url-join";

urlJoin(...parts: Array<string | string[]>): string;
```

Pass segments as separate arguments or as one array. Empty segments are skipped,
empty input returns `""`, and any non-string segment throws a `TypeError`.

## Usage

```ts
import { urlJoin } from "@beankit/url-join";

urlJoin("http://api.test", "v1", "users"); // "http://api.test/v1/users"
urlJoin("http://api.test/", "/v1/", "/users/"); // "http://api.test/v1/users/"
urlJoin(["http://api.test", "v1"]); // "http://api.test/v1"
urlJoin("http://api.test", "?a=1", "?b=2"); // "http://api.test?a=1&b=2"
urlJoin("http://api.test", "page#section"); // "http://api.test/page#section"
urlJoin("127.0.0.1:5500", "data"); // "127.0.0.1:5500/data"
urlJoin("http://foo.com#", "/tenant"); // "http://foo.com#/tenant"
```

## Rules

- Duplicate slashes collapse; an explicit slash before a query or hash is kept
  (`"http://foo.com/"` + `"?a=1"` → `"http://foo.com/?a=1"`).
- A protocol prefix normalizes to `protocol://` (`file:` keeps `file:///`).
- Hosts with ports (`"127.0.0.1:5500"`) and IPv6 hosts (`"[::1]:8080"`) are left alone.
- A protocol-only (`"http:"`) or root (`"/"`) first segment merges with the next part.
- Query parts merge with `&`; a dangling `?` is dropped; query-only input keeps its
  `?` (`"?a=1"` → `"?a=1"`).
- The hash suffix is preserved; after `#` the slash is kept only when the input had
  one (`"#"` + `"/tenant"` → `"#/tenant"`); an empty hash is dropped.
- Hashbang (`#!`) keeps its leading slash.
- Empty input (or all-empty segments) returns `""`.
- Any non-string segment throws a `TypeError`.

Works in Node.js, the browser, and workers: no runtime dependencies, no platform APIs.
