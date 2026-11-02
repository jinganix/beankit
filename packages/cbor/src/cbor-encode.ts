import { type BytePart, writeHead } from "./cbor-write";
import {
  CBORTag,
  type BigIntCBORType,
  type CBORType,
  MAJOR_TYPE_ARRAY,
  MAJOR_TYPE_BYTE_STRING,
  MAJOR_TYPE_MAP,
  MAJOR_TYPE_NEGATIVE_INTEGER,
  MAJOR_TYPE_TAG,
  MAJOR_TYPE_TEXT_STRING,
  MAJOR_TYPE_UNSIGNED_INTEGER,
  type MajorType,
} from "./cbor-types";
import { getTextCodec } from "./text-codec";

/**
 * Encodes one head from a magnitude: major type 1 stores `magnitude - 1`, the other
 * major types store the magnitude itself. The default entry point takes numbers only;
 * the bigint entry point swaps in an implementation that also accepts bigint.
 */
export type WriteArgument = (major: MajorType, magnitude: number | bigint) => number[];

const SIMPLE_FALSE = 0xf4;
const SIMPLE_TRUE = 0xf5;
const SIMPLE_NULL = 0xf6;
const SIMPLE_UNDEFINED = 0xf7;
const FLOAT_32 = 0xfa;
const FLOAT_64 = 0xfb;

function writeFloat(value: number): Uint8Array {
  // float32 whenever it is lossless, which includes every non-finite value.
  if (!Number.isFinite(value) || Math.fround(value) === value) {
    const bytes = new Uint8Array(5);
    const view = new DataView(bytes.buffer);
    view.setUint8(0, FLOAT_32);
    view.setFloat32(1, value, false);
    return bytes;
  }
  const bytes = new Uint8Array(9);
  const view = new DataView(bytes.buffer);
  view.setUint8(0, FLOAT_64);
  view.setFloat64(1, value, false);
  return bytes;
}

function writeNumber(value: number, out: BytePart[], writeArgument: WriteArgument): void {
  // -0 keeps its sign only as a float, and anything outside the safe range does too.
  if (Object.is(value, -0) || !Number.isSafeInteger(value)) {
    out.push(writeFloat(value));
    return;
  }
  out.push(
    ...writeArgument(
      value < 0 ? MAJOR_TYPE_NEGATIVE_INTEGER : MAJOR_TYPE_UNSIGNED_INTEGER,
      value < 0 ? -value : value,
    ),
  );
}

function writeValue(value: BigIntCBORType, out: BytePart[], writeArgument: WriteArgument): void {
  switch (typeof value) {
    case "boolean":
      out.push(value ? SIMPLE_TRUE : SIMPLE_FALSE);
      return;
    case "number":
      writeNumber(value, out, writeArgument);
      return;
    case "bigint":
      out.push(
        ...writeArgument(
          value < 0 ? MAJOR_TYPE_NEGATIVE_INTEGER : MAJOR_TYPE_UNSIGNED_INTEGER,
          value < 0 ? -value : value,
        ),
      );
      return;
    case "string": {
      const encoded = getTextCodec().encode(value);
      out.push(...writeHead(MAJOR_TYPE_TEXT_STRING, encoded.length));
      out.push(encoded);
      return;
    }
    case "undefined":
      out.push(SIMPLE_UNDEFINED);
      return;
    case "object":
      writeObject(value, out, writeArgument);
      return;
    default:
      throw new Error(`cannot encode a ${typeof value}`);
  }
}

function writeObject(
  value: Exclude<BigIntCBORType, number | string | boolean | bigint | undefined>,
  out: BytePart[],
  writeArgument: WriteArgument,
): void {
  if (value === null) {
    out.push(SIMPLE_NULL);
    return;
  }
  if (value instanceof Uint8Array) {
    out.push(...writeHead(MAJOR_TYPE_BYTE_STRING, value.length));
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    out.push(...writeHead(MAJOR_TYPE_ARRAY, value.length));
    for (const item of value) {
      writeValue(item, out, writeArgument);
    }
    return;
  }
  if (value instanceof Map) {
    out.push(...writeHead(MAJOR_TYPE_MAP, value.size));
    for (const [key, item] of value) {
      writeValue(key, out, writeArgument);
      writeValue(item, out, writeArgument);
    }
    return;
  }
  if (value instanceof CBORTag) {
    out.push(...writeArgument(MAJOR_TYPE_TAG, value.tag));
    writeValue(value.value, out, writeArgument);
    return;
  }
  throw new Error("cannot encode a plain object");
}

function concatBytes(parts: BytePart[]): Uint8Array {
  let length = 0;
  for (const part of parts) {
    length += typeof part === "number" ? 1 : part.length;
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    if (typeof part === "number") {
      bytes[offset] = part;
      offset += 1;
    } else {
      bytes.set(part, offset);
      offset += part.length;
    }
  }
  return bytes;
}

export function encodeValueWithBigInt(
  value: BigIntCBORType,
  writeArgument: WriteArgument,
): Uint8Array {
  const parts: BytePart[] = [];
  writeValue(value, parts, writeArgument);
  return concatBytes(parts);
}

/** Head encoder for the default entry point, where every magnitude is a number. */
export function writeNumberArgument(major: MajorType, magnitude: number | bigint): number[] {
  if (typeof magnitude === "bigint") {
    throw new Error(
      `cannot encode the bigint ${String(magnitude)} without the bigint entry point ` +
        "(@beankit/cbor/bigint)",
    );
  }
  return writeHead(major, major === MAJOR_TYPE_NEGATIVE_INTEGER ? magnitude - 1 : magnitude);
}

export function encodeCBOR(value: CBORType): Uint8Array {
  return encodeValueWithBigInt(value, writeNumberArgument);
}
