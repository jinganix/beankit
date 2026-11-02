import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CBORTag,
  decodeCBORWithBigInt,
  decodePartialCBORWithBigInt,
  encodeCBORWithBigInt,
} from "./bigint";
import { decodeCBOR } from "./index";

function decodeHex(hex: string): Uint8Array {
  const normalized = hex.replace(/\s/g, "");
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

describe("cbor with bigint", () => {
  it("should keep small integers as numbers when decoding", () => {
    expect(decodeCBORWithBigInt(new Uint8Array([5]))).toBe(5);
    expect(decodeCBORWithBigInt(new Uint8Array([0x24]))).toBe(-5);
    expect(decodeCBORWithBigInt(decodeHex("190018"))).toBe(24);
  });

  it("should decode integers above safe range as bigint", () => {
    const decoded = decodeCBORWithBigInt(decodeHex("1b8000000000000000"));
    expect(decoded).toBe(9223372036854775808n);
    expect(typeof decoded).toBe("bigint");
    expect(decodeCBORWithBigInt(decodeHex("1bffffffffffffffff"))).toBe(18446744073709551615n);
  });

  it("should decode negative integers below safe range as bigint", () => {
    expect(decodeCBORWithBigInt(decodeHex("3bffffffffffffffff"))).toBe(-18446744073709551616n);
    expect(decodeCBORWithBigInt(decodeHex("3b8000000000000000"))).toBe(-9223372036854775809n);
    expect(decodeCBORWithBigInt(decodeHex("3b001fffffffffffff"))).toBe(-9007199254740992n);
  });

  it("should round-trip the negative safe boundary as bigint", () => {
    expect(decodeCBORWithBigInt(encodeCBORWithBigInt(-9007199254740992n))).toBe(-9007199254740992n);
  });

  it("should encode small bigints minimally when value fits safe range", () => {
    expect(encodeCBORWithBigInt(5n)).toEqual(new Uint8Array([5]));
    expect(encodeCBORWithBigInt(-5n)).toEqual(new Uint8Array([0x24]));
    expect(encodeCBORWithBigInt(24n)).toEqual(new Uint8Array([0x18, 24]));
    expect(encodeCBORWithBigInt(-25n)).toEqual(new Uint8Array([0x38, 24]));
    expect(encodeCBORWithBigInt(256n)).toEqual(new Uint8Array([0x19, 0x01, 0x00]));
  });

  it("should encode large bigints as 8-byte integers when value exceeds safe range", () => {
    expect(encodeCBORWithBigInt(9007199254740993n)).toEqual(decodeHex("1b0020000000000001"));
    expect(encodeCBORWithBigInt(18446744073709551615n)).toEqual(decodeHex("1bffffffffffffffff"));
    expect(encodeCBORWithBigInt(-18446744073709551616n)).toEqual(decodeHex("3bffffffffffffffff"));
  });

  it("should round-trip bigints nested in arrays maps and tags", () => {
    const value = [
      18446744073709551615n,
      new Map<string, bigint>([["n", -18446744073709551616n]]),
      new CBORTag(1, 42n),
    ];
    const decoded = decodeCBORWithBigInt(encodeCBORWithBigInt(value)) as [
      bigint,
      Map<string, bigint>,
      CBORTag,
    ];
    expect(decoded[0]).toBe(18446744073709551615n);
    expect(decoded[1]).toEqual(new Map([["n", -18446744073709551616n]]));
    // 42n is small enough to encode minimally, so it decodes back as number.
    expect(decoded[2]).toEqual(new CBORTag(1, 42));
  });

  it("should encode bigint tag numbers across every length width", () => {
    const cases: Array<[number | bigint, string]> = [
      [23n, "d700"],
      [255n, "d8ff00"],
      [65535n, "d9ffff00"],
      [4294967295n, "daffffffff00"],
      [4294967296n, "db000000010000000000"],
      [9223372036854775808n, "db800000000000000000"],
    ];
    for (const [tag, hex] of cases) {
      expect(encodeCBORWithBigInt(new CBORTag(tag, 0))).toEqual(decodeHex(hex));
    }
    // Number tag numbers keep using the shared number encoder.
    expect(encodeCBORWithBigInt(new CBORTag(24, 0))).toEqual(decodeHex("d81800"));
  });

  it("should encode bigint values across every length width", () => {
    const cases: Array<[bigint, string]> = [
      [23n, "17"],
      [255n, "18ff"],
      [65535n, "19ffff"],
      [4294967295n, "1affffffff"],
      [4294967296n, "1b0000000100000000"],
      [-24n, "37"],
      [-256n, "38ff"],
    ];
    for (const [value, hex] of cases) {
      expect(encodeCBORWithBigInt(value)).toEqual(decodeHex(hex));
    }
  });

  it("should round-trip out-of-range integer map keys", () => {
    const value = new Map<bigint, number>([[18446744073709551615n, 1]]);
    const decoded = decodeCBORWithBigInt(encodeCBORWithBigInt(value));
    expect(decoded).toEqual(value);
  });

  it("should reject duplicate out-of-range integer keys", () => {
    // A single out-of-range key decodes, so the throw below comes from the duplicate check.
    expect(decodeCBORWithBigInt(decodeHex("a11bffffffffffffffff01"))).toEqual(
      new Map([[18446744073709551615n, 1]]),
    );
    expect(() =>
      decodeCBORWithBigInt(decodeHex("a21bffffffffffffffff011bffffffffffffffff02")),
    ).toThrow(/duplicate map key/);
  });

  it("should decode bigint tag numbers above the safe range", () => {
    const decoded = decodeCBORWithBigInt(decodeHex("db80000000000000006178")) as CBORTag;
    expect(decoded.tag).toBe(9223372036854775808n);
    expect(decoded.value).toBe("x");
  });

  it("should reject negative bigint tag numbers", () => {
    expect(() => encodeCBORWithBigInt(new CBORTag(-1n, 1))).toThrow(/must not be negative/);
  });

  it("should reject bigints outside uint64 range when encoding", () => {
    expect(() => encodeCBORWithBigInt(18446744073709551616n)).toThrow(/out of range/);
    expect(() => encodeCBORWithBigInt(-18446744073709551617n)).toThrow(/out of range/);
  });

  it("should decode partially when reading from an index", () => {
    const stream = new Uint8Array([0x05, 0x1b, 0x80, 0, 0, 0, 0, 0, 0, 0]);
    expect(decodePartialCBORWithBigInt(stream, 1)).toEqual([9223372036854775808n, 9]);
  });

  it("should throw when trailing bytes remain", () => {
    expect(() => decodeCBORWithBigInt(new Uint8Array([5, 5]))).toThrow(/ends at byte/);
  });

  it("should stay compatible with the default entry point byte for byte", () => {
    expect(encodeCBORWithBigInt(42)).toEqual(decodeHex("182a"));
    expect(decodeCBOR(encodeCBORWithBigInt(18446744073709551615n))).toBe("18446744073709551615");
  });
});

/**
 * Even on an engine without BigInt this module must *load*: everything that
 * touches the `BigInt` global lives inside a function. A bundler that wrongly
 * inlines the bigint entry into a legacy bundle therefore cannot break the app,
 * it can only make the bigint feature throw when actually used.
 */
describe("cbor bigint entry on a runtime without BigInt", () => {
  const bigintGlobal = (globalThis as Record<string, unknown>).BigInt;

  afterEach(() => {
    (globalThis as Record<string, unknown>).BigInt = bigintGlobal;
    vi.resetModules();
  });

  it("should load without touching BigInt and only fail when called", async () => {
    Reflect.deleteProperty(globalThis, "BigInt");
    expect(typeof BigInt).toBe("undefined");
    vi.resetModules();

    const mod = await import("./bigint");
    expect(typeof mod.encodeCBORWithBigInt).toBe("function");

    // Reaching the revival path is the only thing that fails, and it stays catchable.
    expect(() => mod.decodeCBORWithBigInt(decodeHex("1b8000000000000000"))).toThrow(ReferenceError);
    expect(() => mod.encodeCBORWithBigInt(1n)).toThrow(ReferenceError);
  });
});
