import { formatUint64, incrementDecimal, Reader, TWO_POW_32 } from "./cbor-read";
import {
  CBORTag,
  type BigIntCBORType,
  type CBORInput,
  type CBORMapKey,
  type CBORType,
  MAJOR_TYPE_ARRAY,
  MAJOR_TYPE_BYTE_STRING,
  MAJOR_TYPE_MAP,
  MAJOR_TYPE_NEGATIVE_INTEGER,
  MAJOR_TYPE_SIMPLE_OR_FLOAT,
  MAJOR_TYPE_TAG,
  MAJOR_TYPE_TEXT_STRING,
  MAJOR_TYPE_UNSIGNED_INTEGER,
  type MajorType,
} from "./cbor-types";
import { getTextCodec } from "./text-codec";

/**
 * Turns a decimal integer that does not fit a JS number into a bigint. Only the
 * `@beankit/cbor/bigint` entry point passes one, so this file never touches the
 * `BigInt` global by itself.
 */
export type ReviveBigInt = (decimal: string) => bigint;

const BREAK = 0xff;
const HALF_POSITIVE_INFINITY = 0x7c00;
const HALF_NEGATIVE_INFINITY = 0xfc00;
const HALF_NAN = 0x7e00;

type SimpleValue = boolean | null | undefined;

function decodeValue(reader: Reader, revive?: ReviveBigInt): BigIntCBORType {
  const head = reader.uint8();
  const major = (head >> 5) as MajorType;
  const argument = head & 0x1f;
  switch (major) {
    case MAJOR_TYPE_UNSIGNED_INTEGER:
      return decodeInteger(reader, argument, false, revive);
    case MAJOR_TYPE_NEGATIVE_INTEGER:
      return decodeInteger(reader, argument, true, revive);
    case MAJOR_TYPE_BYTE_STRING:
      return decodeStringBody(reader, argument, MAJOR_TYPE_BYTE_STRING);
    case MAJOR_TYPE_TEXT_STRING:
      return getTextCodec().decode(decodeStringBody(reader, argument, MAJOR_TYPE_TEXT_STRING));
    case MAJOR_TYPE_ARRAY:
      return decodeArray(reader, argument, revive);
    case MAJOR_TYPE_MAP:
      return decodeMap(reader, argument, revive);
    case MAJOR_TYPE_TAG:
      return new CBORTag(decodeTagNumber(reader, argument, revive), decodeValue(reader, revive));
    case MAJOR_TYPE_SIMPLE_OR_FLOAT:
      return decodeSimple(reader, argument);
  }
}

/**
 * Decodes major types 0 and 1. Magnitudes that a JS number cannot represent exactly
 * become decimal strings, or bigint when a reviver is supplied.
 */
function decodeInteger(
  reader: Reader,
  argument: number,
  negative: boolean,
  revive?: ReviveBigInt,
): number | bigint | string {
  if (argument < 24) {
    return negative ? -argument - 1 : argument;
  }
  const [high, low] = reader.extendedArgument(argument);
  const magnitude = high * TWO_POW_32 + low;
  if (!negative && Number.isSafeInteger(magnitude)) {
    return magnitude;
  }
  // n encodes -(n + 1), so the result is only safe while n + 1 fits.
  if (negative && Number.isSafeInteger(magnitude) && magnitude < Number.MAX_SAFE_INTEGER) {
    return -magnitude - 1;
  }
  const decimal = formatUint64(high, low);
  const text = negative ? `-${incrementDecimal(decimal)}` : decimal;
  return revive === undefined ? text : revive(text);
}

/** Tag numbers follow the integer rule: number while safe, bigint in the bigint entry. */
function decodeTagNumber(reader: Reader, argument: number, revive?: ReviveBigInt): number | bigint {
  const value = decodeInteger(reader, argument, false, revive);
  if (typeof value !== "string") {
    return value;
  }
  throw new Error(
    `tag number ${value} is out of the safe integer range; ` +
      "use the bigint entry point (@beankit/cbor/bigint)",
  );
}

/** Reads a definite length argument, shared by strings, arrays and maps. */
function readLength(reader: Reader, argument: number): number {
  if (argument < 24) {
    return argument;
  }
  const [high, low] = reader.extendedArgument(argument);
  return high * TWO_POW_32 + low;
}

/**
 * Reads the body of a byte or text string. Chunks of an indefinite-length string must
 * carry the same major type and a definite length (RFC 8949 §3.1.3, §3.2.3); the bytes
 * are concatenated before the caller interprets them.
 */
function decodeStringBody(reader: Reader, argument: number, major: MajorType): Uint8Array {
  if (argument !== 31) {
    return reader.take(readLength(reader, argument));
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (reader.peek() !== BREAK) {
    const head = reader.uint8();
    if (head >> 5 !== major) {
      throw new Error("chunk of an indefinite-length string has the wrong type");
    }
    const chunkArgument = head & 0x1f;
    if (chunkArgument === 31) {
      throw new Error("chunk of an indefinite-length string must be definite-length");
    }
    const chunk = reader.take(readLength(reader, chunkArgument));
    chunks.push(chunk);
    total += chunk.length;
  }
  reader.uint8();
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function decodeArray(reader: Reader, argument: number, revive?: ReviveBigInt): BigIntCBORType[] {
  const values: BigIntCBORType[] = [];
  if (argument === 31) {
    while (reader.peek() !== BREAK) {
      values.push(decodeValue(reader, revive));
    }
    reader.uint8();
    return values;
  }
  const length = readLength(reader, argument);
  for (let i = 0; i < length; i++) {
    values.push(decodeValue(reader, revive));
  }
  return values;
}

function decodeMap(
  reader: Reader,
  argument: number,
  revive?: ReviveBigInt,
): Map<CBORMapKey, BigIntCBORType> {
  const entries = new Map<CBORMapKey, BigIntCBORType>();
  if (argument === 31) {
    while (reader.peek() !== BREAK) {
      decodeEntry(reader, entries, revive);
    }
    reader.uint8();
    return entries;
  }
  const length = readLength(reader, argument);
  for (let i = 0; i < length; i++) {
    decodeEntry(reader, entries, revive);
  }
  return entries;
}

function decodeEntry(
  reader: Reader,
  entries: Map<CBORMapKey, BigIntCBORType>,
  revive?: ReviveBigInt,
): void {
  const key = decodeValue(reader, revive);
  if (typeof key !== "string" && typeof key !== "number" && typeof key !== "bigint") {
    throw new Error("map key must be a string, number or bigint");
  }
  if (entries.has(key)) {
    throw new Error(`duplicate map key ${String(key)}`);
  }
  entries.set(key, decodeValue(reader, revive));
}

function decodeSimple(reader: Reader, argument: number): SimpleValue | number {
  switch (argument) {
    case 20:
      return false;
    case 21:
      return true;
    case 22:
      return null;
    case 23:
      return undefined;
    case 25:
      return decodeHalfFloat(reader);
    case 26:
      return reader.float32();
    case 27:
      return reader.float64();
    default:
      throw new Error(`unsupported simple value ${argument}`);
  }
}

/** Only the float16 specials are supported; every finite half float reads as an error. */
function decodeHalfFloat(reader: Reader): number {
  const bits = reader.uint16();
  switch (bits) {
    case HALF_POSITIVE_INFINITY:
      return Infinity;
    case HALF_NEGATIVE_INFINITY:
      return -Infinity;
    case HALF_NAN:
      return NaN;
    default:
      throw new Error("unsupported float16 value");
  }
}

/**
 * Accepts what callers actually pass: a DataView, a typed-array view, an ArrayBuffer or
 * a SharedArrayBuffer (also from another realm, hence the tag check).
 */
function toDataView(input: CBORInput): DataView {
  if (ArrayBuffer.isView(input)) {
    return new DataView(input.buffer, input.byteOffset, input.byteLength);
  }
  const tag = Object.prototype.toString.call(input);
  if (tag === "[object ArrayBuffer]" || tag === "[object SharedArrayBuffer]") {
    return new DataView(input as ArrayBufferLike);
  }
  throw new Error("expected a DataView, typed array, ArrayBuffer or SharedArrayBuffer");
}

export function decodePartialWithReviver(
  input: CBORInput,
  index: number,
  revive?: ReviveBigInt,
): [BigIntCBORType, number] {
  const reader = new Reader(toDataView(input), index);
  if (index < 0 || reader.exhausted) {
    throw new Error(`no CBOR item at offset ${index}`);
  }
  const value = decodeValue(reader, revive);
  return [value, reader.offset - index];
}

export function decodeCompleteWithReviver(input: CBORInput, revive?: ReviveBigInt): BigIntCBORType {
  const [value, length] = decodePartialWithReviver(input, 0, revive);
  if (length !== input.byteLength) {
    throw new Error(`CBOR item ends at byte ${length}, but the input is ${input.byteLength} bytes`);
  }
  return value;
}

export function decodePartialCBOR(input: CBORInput, index: number): [CBORType, number] {
  // Without a reviver this codec never produces a bigint, so the cast is sound.
  return decodePartialWithReviver(input, index) as [CBORType, number];
}

export function decodeCBOR(input: CBORInput): CBORType {
  return decodeCompleteWithReviver(input) as CBORType;
}
