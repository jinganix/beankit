import type { MajorType } from "./cbor-types";

/** A piece of the encoded output: one head byte, or a run of bytes copied as-is. */
export type BytePart = number | Uint8Array;

/**
 * Encodes a head: the major type in the top three bits, the argument in the rest.
 * The argument is the value itself, so major type 1 receives the caller's `-(n + 1)`
 * and major type 6 the tag number.
 */
export function writeHead(major: MajorType, argument: number): number[] {
  if (!Number.isInteger(argument) || argument < 0) {
    throw new Error(`CBOR head argument must be a non-negative integer, got ${argument}`);
  }
  if (!Number.isSafeInteger(argument)) {
    throw new Error(`CBOR head argument out of range: ${argument}`);
  }
  const prefix = major << 5;
  if (argument <= 0x17) {
    return [prefix | argument];
  }
  let marker: number;
  let width: number;
  if (argument <= 0xff) {
    marker = 24;
    width = 1;
  } else if (argument <= 0xffff) {
    marker = 25;
    width = 2;
  } else if (argument <= 0xffff_ffff) {
    marker = 26;
    width = 4;
  } else {
    marker = 27;
    width = 8;
  }
  const bytes = [prefix | marker];
  for (let shift = (width - 1) * 8; shift >= 0; shift -= 8) {
    bytes.push(Math.floor(argument / 2 ** shift) & 0xff);
  }
  return bytes;
}
