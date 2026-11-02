# @beankit/cbor

CBOR encode/decode: maps with string/number keys (plus `bigint` keys via the bigint entry
point below), arrays, integers, float32/64 (plus the Infinity, `-Infinity`, and `NaN` float16
specials), strings, byte strings, booleans, `null`/`undefined`, tags, and indefinite-length
items.

Zero dependencies, works in Node.js, browsers, and workers (ships ESM, CJS,
and types).

```bash
npm i @beankit/cbor
```

## API

```ts
import { decodeCBOR, decodePartialCBOR, encodeCBOR } from "@beankit/cbor";

// Encode a simple structure
const bytes = encodeCBOR(new Map([["hello", "world"]]));
decodeCBOR(bytes); // Map(1) { "hello" => "world" }

// Decode one value out of a larger stream
const [value, consumed] = decodePartialCBOR(bytes, 0);
```

Tags are preserved without interpretation: `decodeCBOR` returns
`CBORTag(tag, value)` and `encodeCBOR` accepts it back.

## BigInt: two entry points

The default entry point is BigInt-free: integers outside the safe range
decode to decimal strings (e.g. `"9223372036854775808"`), and encoding a
`bigint` throws a helpful error. It never references the `BigInt` global, so
it parses and runs on runtimes without BigInt (very old browsers, JSCore,
etc.) — just don't import the subpath below.

```ts
import { decodeCBORWithBigInt, encodeCBORWithBigInt } from "@beankit/cbor/bigint";

decodeCBORWithBigInt(encodeCBORWithBigInt(2n ** 64n - 1n)); // 18446744073709551615n
```

Values that fit the safe range still decode to `number`; only
out-of-range integers become `bigint`, so small payloads are unaffected.
Both entry points produce byte-identical output for safe values.

Tag numbers follow the same rule: `number` while they fit the safe range,
`bigint` above it (the default entry throws and points you at the bigint
entry point instead of guessing). Map keys follow it too: an out-of-range
integer key decodes as a `bigint` key here, and as a decimal-string key in
the default entry.

Using `@beankit/all`? Import `@beankit/all/bigint` for the same codec.

## Notes

- **Syntax floor is ES2019, deliberately.** The build lowers class fields and
  bigint literals instead of emitting ES2022, because the devices this package
  targets (iOS <= 13, Safari 14.0, Chrome < 72) parse neither. Everything this
  package ships parses as ES2015/ES2019.
- **Even the bigint entry is load-safe.** Everything that touches the `BigInt`
  global sits inside a function, so on a BigInt-less engine the module still
  loads and only _calling_ it throws a catchable `ReferenceError`. Inlining it
  by mistake cannot take the rest of your app down.
- Byte strings are `Uint8Array` (or a subclass such as Node's `Buffer`). Other
  typed arrays are rejected rather than re-encoded as their underlying bytes.
- Indefinite-length byte strings, text strings, arrays, and maps decode too.
  Their chunks must be definite-length and of the matching string type, as
  RFC 8949 requires.
- Encoding always writes valid UTF-8: an unpaired surrogate becomes `U+FFFD`,
  byte-for-byte like `TextEncoder`, in both the native and the pure-JS fallback
  codec (the fallback is used on runtimes without `TextEncoder`/`TextDecoder`,
  e.g. WeChat MiniProgram JSCore). Malformed UTF-8 _input_ is not rejected: the
  native `TextDecoder` substitutes `U+FFFD` and the fallback decodes it
  leniently, so a text string that is not valid UTF-8 survives as some string.
- Non-minimal length prefixes (e.g. the value `5` written as 8 bytes,
  `1b0000000000000005`) are rejected as not well formed. RFC 8949 §4.2.1 lets a
  decoder refuse non-preferred serializations; this one does, so re-encodings
  stay canonical.

## Non-goals

- No plain-object support: maps are `Map`, not `{}`.
- No JSON bridge (`encodeJsonCbor`): convert between `Map`
  and objects in one line at the call site if you need it.
