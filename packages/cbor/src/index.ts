/**
 * CBOR encode/decode: maps with string/number keys (`bigint` keys through the bigint entry
 * point), arrays, integers, float32/64 (plus the Infinity/-Infinity/NaN float16 specials),
 * strings, byte strings, booleans, null/undefined, tags, and indefinite-length items.
 *
 * BigInt-free by default: integers outside the safe range decode to decimal
 * strings, and this entry point never touches the `BigInt` global, so it
 * parses and runs on runtimes without BigInt. For native bigint support,
 * import from `@beankit/cbor/bigint` instead.
 *
 * @example
 * import { decodeCBOR, encodeCBOR } from "@beankit/cbor";
 *
 * decodeCBOR(encodeCBOR("hello world")); // "hello world"
 */
export { decodeCBOR, decodePartialCBOR } from "./cbor-decode";
export { encodeCBOR } from "./cbor-encode";
export {
  CBORTag,
  type BigIntCBORType,
  type CBORInput,
  type CBORMapKey,
  type CBORType,
  type MajorType,
  MAJOR_TYPE_ARRAY,
  MAJOR_TYPE_BYTE_STRING,
  MAJOR_TYPE_MAP,
  MAJOR_TYPE_NEGATIVE_INTEGER,
  MAJOR_TYPE_SIMPLE_OR_FLOAT,
  MAJOR_TYPE_TAG,
  MAJOR_TYPE_TEXT_STRING,
  MAJOR_TYPE_UNSIGNED_INTEGER,
} from "./cbor-types";
