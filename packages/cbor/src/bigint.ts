import { encodeValueWithBigInt, writeNumberArgument } from "./cbor-encode";
import {
  decodeCompleteWithReviver,
  decodePartialWithReviver,
  type ReviveBigInt,
} from "./cbor-decode";
import {
  CBORTag,
  type BigIntCBORType,
  type CBORInput,
  MAJOR_TYPE_NEGATIVE_INTEGER,
  type MajorType,
} from "./cbor-types";
import { writeHead } from "./cbor-write";

/**
 * Opt-in bigint support for `@beankit/cbor`.
 *
 * Importing this module is the only way to reach the `BigInt` global, so keep it out of
 * bundles that must run on runtimes without BigInt (very old browsers, JSCore, etc.) and
 * use the default entry point instead, where out-of-range integers decode to decimal
 * strings.
 *
 * ```ts
 * import { decodeCBORWithBigInt, encodeCBORWithBigInt } from "@beankit/cbor/bigint";
 * ```
 */

// Kept as text: esbuild lowers a bigint literal to a BigInt() call, and a bundler that
// hoisted one to module scope would break an engine without BigInt at import time.
const MAX_UINT64 = "18446744073709551615";

const reviveBigInt: ReviveBigInt = (decimal) => BigInt(decimal);

/**
 * Head encoder of the bigint entry point. Magnitudes that fit a number go through the
 * number encoder, which already picks the shortest head.
 */
function writeBigArgument(major: MajorType, magnitude: number | bigint): number[] {
  if (typeof magnitude === "number") {
    return writeNumberArgument(major, magnitude);
  }
  if (magnitude < 0) {
    throw new Error(`CBOR head argument must not be negative, got ${String(magnitude)}`);
  }
  const argument = major === MAJOR_TYPE_NEGATIVE_INTEGER ? magnitude - 1n : magnitude;
  if (argument > BigInt(MAX_UINT64)) {
    throw new Error(`CBOR head argument out of range: ${String(argument)}`);
  }
  if (argument < 4294967296) {
    return writeHead(major, Number(argument));
  }
  const bytes = [(major << 5) | 27];
  for (let shift = 56n; shift >= 0n; shift -= 8n) {
    bytes.push(Number((argument >> shift) & 0xffn));
  }
  return bytes;
}

export function encodeCBORWithBigInt(value: BigIntCBORType): Uint8Array {
  return encodeValueWithBigInt(value, writeBigArgument);
}

export function decodePartialCBORWithBigInt(
  input: CBORInput,
  index: number,
): [BigIntCBORType, number] {
  return decodePartialWithReviver(input, index, reviveBigInt);
}

export function decodeCBORWithBigInt(input: CBORInput): BigIntCBORType {
  return decodeCompleteWithReviver(input, reviveBigInt);
}

export { CBORTag };
