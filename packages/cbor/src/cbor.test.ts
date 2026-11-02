import { describe, expect, it } from "vitest";

import { decodeCBOR, decodePartialCBOR, encodeCBOR } from "./index";
import { formatUint64, incrementDecimal } from "./cbor-read";
import { CBORTag, type CBORType, MAJOR_TYPE_UNSIGNED_INTEGER } from "./cbor-types";
import { writeHead } from "./cbor-write";

function decodeHex(hex: string): Uint8Array {
  const normalized = hex.replace(/\s/g, "");
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

const HELLO_WORLD_CBOR = decodeHex("6b68656c6c6f20776f726c64");
const BYTES_HELLO_WORLD_CBOR = decodeHex("4b68656c6c6f20776f726c64");
const LOWER_ALPHABET_CBOR = decodeHex("781a6162636465666768696a6b6c6d6e6f707172737475767778797a");
const HELLO_WORLD_AS_BYTES = decodeHex("68656c6c6f20776f726c64");
const LONG_ARRAY_CBOR = decodeHex("9818000000000000000000000000000000000000000000000000");
const LONG_ARRAY = new Array<number>(0x18).fill(0);
const LOWER_ALPHABET_BYTES = new TextEncoder().encode("abcdefghijklmnopqrstuvwxyz");
const LOWER_ALPHABET_BYTES_CBOR = decodeHex(
  "581a6162636465666768696a6b6c6d6e6f707172737475767778797a",
);

describe("cbor", () => {
  it("should throw when input is empty or the offset is out of range", () => {
    expect(() => decodeCBOR(new Uint8Array([]))).toThrow(/no CBOR item/);
    expect(() => decodePartialCBOR(new Uint8Array([]), -1)).toThrow(/no CBOR item/);
    expect(() => decodePartialCBOR(new Uint8Array([]), 1)).toThrow(/no CBOR item/);
    // Data present, so only the negative-offset guard can reject this.
    expect(() => decodePartialCBOR(new Uint8Array([0x05]), -1)).toThrow(/no CBOR item/);
    expect(() => decodePartialCBOR(new Uint8Array([0x05]), 1)).toThrow(/no CBOR item/);
  });

  it("should round-trip single-byte unsigned integers when encoding small values", () => {
    for (const value of [0, 1, 23]) {
      expect(decodeCBOR(new Uint8Array([value]))).toBe(value);
      expect(encodeCBOR(value)).toEqual(new Uint8Array([value]));
    }
  });

  it("should throw when trailing bytes remain", () => {
    expect(() => decodeCBOR(new Uint8Array([0, 0]))).toThrow(/ends at byte/);
  });

  it("should round-trip short strings when encoding hello world", () => {
    expect(decodeCBOR(HELLO_WORLD_CBOR)).toBe("hello world");
    expect(encodeCBOR("hello world")).toEqual(HELLO_WORLD_CBOR);
  });

  it("should round-trip longer strings when encoding the alphabet", () => {
    const text = "abcdefghijklmnopqrstuvwxyz";
    expect(decodeCBOR(LOWER_ALPHABET_CBOR)).toBe(text);
    expect(encodeCBOR(text)).toEqual(LOWER_ALPHABET_CBOR);
  });

  it("should round-trip multibyte strings when encoding non-ascii text", () => {
    for (const text of ["café", "康养名录", "🎉"]) {
      expect(decodeCBOR(encodeCBOR(text))).toBe(text);
    }
  });

  it("should round-trip byte strings when encoding binary data", () => {
    expect(decodeCBOR(BYTES_HELLO_WORLD_CBOR)).toEqual(HELLO_WORLD_AS_BYTES);
    expect(encodeCBOR(HELLO_WORLD_AS_BYTES)).toEqual(BYTES_HELLO_WORLD_CBOR);
    const decodedAlphabet = decodeCBOR(LOWER_ALPHABET_BYTES_CBOR) as Uint8Array;
    expect(Array.from(decodedAlphabet)).toEqual(Array.from(LOWER_ALPHABET_BYTES));
    expect(encodeCBOR(LOWER_ALPHABET_BYTES)).toEqual(LOWER_ALPHABET_BYTES_CBOR);
  });

  it("should round-trip empty byte strings when encoding zero bytes", () => {
    expect(decodeCBOR(new Uint8Array([0x40]))).toEqual(new Uint8Array([]));
    expect(encodeCBOR(new Uint8Array([]))).toEqual(new Uint8Array([0x40]));
  });

  it("should round-trip arrays when encoding fixed and long arrays", () => {
    expect(decodeCBOR(new Uint8Array([0x82, 1, 2]))).toEqual([1, 2]);
    expect(encodeCBOR([1, 2])).toEqual(new Uint8Array([0x82, 1, 2]));
    expect(decodeCBOR(LONG_ARRAY_CBOR)).toEqual(LONG_ARRAY);
    expect(encodeCBOR(LONG_ARRAY)).toEqual(LONG_ARRAY_CBOR);
  });

  it("should round-trip maps when keys are strings or integers", () => {
    expect(decodeCBOR(new Uint8Array([0xa1, 0x61, 0x31, 1]))).toEqual(new Map([["1", 1]]));
    expect(encodeCBOR(new Map([["1", 1]]))).toEqual(new Uint8Array([0xa1, 0x61, 0x31, 1]));
    expect(decodeCBOR(decodeHex("a10102"))).toEqual(new Map<number | string, number>([[1, 2]]));
  });

  it("should round-trip booleans null and undefined when encoding simple values", () => {
    expect(decodeCBOR(new Uint8Array([0xf4]))).toBe(false);
    expect(decodeCBOR(new Uint8Array([0xf5]))).toBe(true);
    expect(decodeCBOR(new Uint8Array([0xf6]))).toBe(null);
    expect(decodeCBOR(new Uint8Array([0xf7]))).toBeUndefined();
    expect(encodeCBOR(false)).toEqual(new Uint8Array([0xf4]));
    expect(encodeCBOR(true)).toEqual(new Uint8Array([0xf5]));
    expect(encodeCBOR(null)).toEqual(new Uint8Array([0xf6]));
    expect(encodeCBOR(undefined)).toEqual(new Uint8Array([0xf7]));
  });

  it("should round-trip floats when decoding float32 and float64", () => {
    expect(decodeCBOR(decodeHex("fa47c35000"))).toBe(100000.0);
    expect(decodeCBOR(decodeHex("fb7e37e43c8800759c"))).toBe(1.0e300);
    expect(encodeCBOR(-4.1)).toEqual(decodeHex("fbc010666666666666"));
  });

  it("should keep the sign of negative zero when encoding", () => {
    expect(encodeCBOR(-0)).toEqual(decodeHex("fa80000000"));
    expect(Object.is(decodeCBOR(encodeCBOR(-0)), -0)).toBe(true);
  });

  it("should encode non-finite floats as float32", () => {
    expect(encodeCBOR(Infinity)[0]).toBe(0xfa);
    expect(decodeCBOR(encodeCBOR(Infinity))).toBe(Infinity);
    expect(decodeCBOR(encodeCBOR(-Infinity))).toBe(-Infinity);
    expect(Number.isNaN(decodeCBOR(encodeCBOR(NaN)) as number)).toBe(true);
  });

  it("should round-trip tagged items when encoding dates", () => {
    expect(decodeCBOR(decodeHex("c074323031332d30332d32315432303a30343a30305a"))).toEqual(
      new CBORTag(0, "2013-03-21T20:04:00Z"),
    );
    expect(encodeCBOR(new CBORTag(0, "2013-03-21T20:04:00Z"))).toEqual(
      decodeHex("c074323031332d30332d32315432303a30343a30305a"),
    );
  });

  it("should decode indefinite-length maps and arrays when input uses break stop codes", () => {
    expect(decodeCBOR(new Uint8Array([0xbf, 0x61, 0x78, 0x01, 0xff]))).toEqual(new Map([["x", 1]]));
    expect(decodeCBOR(new Uint8Array([0x9f, 0x01, 0x02, 0xff]))).toEqual([1, 2]);
    const nested = new Uint8Array([
      0xbf, 0x61, 0x61, 0x00, 0x61, 0x62, 0x9f, 0xbf, 0x64, 0x6e, 0x61, 0x6d, 0x65, 0x67, 0x65,
      0x78, 0x61, 0x6d, 0x70, 0x6c, 0x65, 0xff, 0xff, 0xff,
    ]);
    expect(decodeCBOR(nested)).toEqual(
      new Map<string, CBORType>([
        ["a", 0],
        ["b", [new Map([["name", "example"]])]],
      ]),
    );
  });

  it("should decode from a subarray when input is a view", () => {
    const original = decodeHex("aabb05cc");
    expect(decodeCBOR(original.subarray(2, 3))).toBe(5);
  });

  it("should decode from a raw ArrayBuffer when input is not a view", () => {
    const buffer = new ArrayBuffer(1);
    new Uint8Array(buffer)[0] = 0x05;
    expect(decodeCBOR(buffer)).toBe(5);
    expect(decodePartialCBOR(buffer, 0)).toEqual([5, 1]);
  });

  it("should decode from a SharedArrayBuffer when input is shared memory", () => {
    const shared = new SharedArrayBuffer(1);
    new Uint8Array(shared)[0] = 0x05;
    expect(decodeCBOR(shared)).toBe(5);
  });

  it("should throw when encoding unsupported types", () => {
    expect(() => encodeCBOR({ hello: true } as never)).toThrow(/plain object/);
    expect(() => encodeCBOR(new DataView(new ArrayBuffer(1)) as never)).toThrow(/plain object/);
    // Only byte arrays are byte strings; other views would silently re-encode
    // their underlying bytes.
    expect(() => encodeCBOR(new Uint16Array([0x12_34]) as never)).toThrow(/plain object/);
    expect(() => encodeCBOR(Symbol("nope") as never)).toThrow(/cannot encode a symbol/);
  });

  it("should reject bigint tag numbers without the bigint entry point", () => {
    expect(() => encodeCBOR(new CBORTag(10n, 1) as never)).toThrow(/bigint entry point/);
    expect(() => decodeCBOR(decodeHex("db8000000000000000"))).toThrow(/bigint entry point/);
  });

  it("should throw when encoding a bigint without the bigint entry point", () => {
    expect(() => encodeCBOR(10n as never)).toThrow(/@beankit\/cbor\/bigint/);
  });

  it("should reject tag numbers that are not non-negative integers", () => {
    expect(() => encodeCBOR(new CBORTag(-1, 1))).toThrow(/non-negative integer/);
    expect(() => encodeCBOR(new CBORTag(1.5, 1))).toThrow(/non-negative integer/);
  });

  it("should keep MAX_SAFE_INTEGER as number when decoding", () => {
    const value = Number.MAX_SAFE_INTEGER;
    const encoded = encodeCBOR(value);
    const decoded = decodeCBOR(encoded);
    expect(decoded).toBe(value);
    expect(typeof decoded).toBe("number");
  });

  it("should round-trip the safe integer boundaries when encoding extremes", () => {
    for (const value of [
      Number.MAX_SAFE_INTEGER,
      Number.MIN_SAFE_INTEGER,
      0x1_0000_0000,
      -0x1_0000_0000,
    ]) {
      expect(decodeCBOR(encodeCBOR(value))).toBe(value);
    }
  });

  it("should decode unsigned integers above safe range as decimal strings", () => {
    const tooLarge = decodeHex("1b8000000000000000");
    expect(decodeCBOR(tooLarge)).toBe("9223372036854775808");
    expect(typeof decodeCBOR(tooLarge)).toBe("string");
    expect(decodeCBOR(decodeHex("1bffffffffffffffff"))).toBe("18446744073709551615");
  });

  it("should decode negative integers below safe range as decimal strings", () => {
    expect(decodeCBOR(decodeHex("3bffffffffffffffff"))).toBe("-18446744073709551616");
    expect(decodeCBOR(decodeHex("3b8000000000000000"))).toBe("-9223372036854775809");
    // -(2^53 - 1) - 1 leaves the safe range: still a string, never an unsafe number.
    expect(decodeCBOR(decodeHex("3b001fffffffffffff"))).toBe("-9007199254740992");
    // -(9999999999999999)-1 carries past the most significant digit.
    expect(decodeCBOR(decodeHex("3b002386f26fc0ffff"))).toBe("-10000000000000000");
  });

  it("should decode 8-byte declared lengths when collections use wide lengths", () => {
    const wideArray = new Uint8Array([
      0x9b,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0x18,
      ...new Array<number>(24).fill(0),
    ]);
    expect(decodeCBOR(wideArray)).toEqual(new Array<number>(24).fill(0));
    expect(() => decodeCBOR(decodeHex("9bffffffffffffffff"))).toThrow(/unexpected end/);
  });

  it("should round-trip negative integers when encoding -1", () => {
    expect(decodeCBOR(new Uint8Array([0x20]))).toBe(-1);
    expect(encodeCBOR(-1)).toEqual(new Uint8Array([0x20]));
  });

  it("should encode float64 when value is outside float32 range", () => {
    const value = 1.0e300;
    const encoded = encodeCBOR(value);
    expect(encoded[0]).toBe(0xfb);
    expect(decodeCBOR(encoded)).toBe(value);
  });

  it("should decode float16 special values when input is Infinity or NaN", () => {
    expect(decodeCBOR(decodeHex("f97c00"))).toBe(Infinity);
    expect(decodeCBOR(decodeHex("f9fc00"))).toBe(-Infinity);
    expect(Number.isNaN(decodeCBOR(decodeHex("f97e00")) as number)).toBe(true);
  });

  it("should decode indefinite-length byte strings when chunks are concatenated", () => {
    const encoded = decodeHex("5f4568656c6c6fff");
    const decoded = decodeCBOR(encoded) as Uint8Array;
    expect(Array.from(decoded)).toEqual(Array.from(new TextEncoder().encode("hello")));
  });

  it("should throw when buffer type is unsupported", () => {
    expect(() => decodePartialCBOR({} as never, 0)).toThrow(/expected a DataView/);
  });

  it("should round-trip empty array and map when encoding empty collections", () => {
    expect(decodeCBOR(new Uint8Array([0x80]))).toEqual([]);
    expect(decodeCBOR(new Uint8Array([0xa0]))).toEqual(new Map());
    expect(encodeCBOR([])).toEqual(new Uint8Array([0x80]));
    expect(encodeCBOR(new Map())).toEqual(new Uint8Array([0xa0]));
  });

  describe("argument widths", () => {
    it("should decode 2-byte, 4-byte and 8-byte arguments when widths vary", () => {
      expect(decodeCBOR(decodeHex("190018"))).toBe(24);
      expect(decodeCBOR(decodeHex("1a00000018"))).toBe(24);
      expect(decodeCBOR(decodeHex("1b0000000000000018"))).toBe(24);
    });

    it("should reject truncated or non-preferred arguments when encoding is malformed", () => {
      expect(() => decodeCBOR(decodeHex("18"))).toThrow(/unexpected end/);
      expect(() => decodeCBOR(decodeHex("19"))).toThrow(/unexpected end/);
      expect(() => decodeCBOR(decodeHex("1a"))).toThrow(/unexpected end/);
      expect(() => decodeCBOR(decodeHex("1805"))).toThrow(/non-preferred/);
      expect(() => decodeCBOR(decodeHex("1900"))).toThrow(/unexpected end/);
      expect(() => decodeCBOR(decodeHex("1a000000"))).toThrow(/unexpected end/);
      expect(() => decodeCBOR(decodeHex("1b00000000000000"))).toThrow(/unexpected end/);
      expect(() => decodeCBOR(decodeHex("1b00000000000000 17"))).toThrow(/non-preferred/);
    });

    it("should reject reserved arguments when the low bits are 28 to 30", () => {
      for (const hex of ["1c", "1d", "1e", "3c", "5c", "7c", "9c", "bc", "dc"]) {
        expect(() => decodeCBOR(decodeHex(hex))).toThrow(/reserved CBOR argument/);
      }
      // Major type 7 has no extended argument at all.
      for (const hex of ["fc", "fd", "fe"]) {
        expect(() => decodeCBOR(decodeHex(hex))).toThrow(/unsupported simple value/);
      }
    });
  });

  describe("writeHead ranges", () => {
    it("should encode every argument width", () => {
      expect(writeHead(MAJOR_TYPE_UNSIGNED_INTEGER, 0x17)).toEqual([0x17]);
      expect(writeHead(MAJOR_TYPE_UNSIGNED_INTEGER, 0x18)).toEqual([0x18, 0x18]);
      expect(writeHead(MAJOR_TYPE_UNSIGNED_INTEGER, 0x100)).toEqual([0x19, 0x01, 0x00]);
      expect(writeHead(MAJOR_TYPE_UNSIGNED_INTEGER, 0x1_0000)).toEqual([
        0x1a, 0x00, 0x01, 0x00, 0x00,
      ]);
      expect(writeHead(MAJOR_TYPE_UNSIGNED_INTEGER, 0x1_0000_0000)).toEqual([
        0x1b, 0, 0, 0, 1, 0, 0, 0, 0,
      ]);
    });

    it("should reject arguments a head cannot carry", () => {
      expect(() => writeHead(MAJOR_TYPE_UNSIGNED_INTEGER, -1)).toThrow(/non-negative/);
      expect(() => writeHead(MAJOR_TYPE_UNSIGNED_INTEGER, 1.5)).toThrow(/non-negative/);
      expect(() => writeHead(MAJOR_TYPE_UNSIGNED_INTEGER, Number.MAX_SAFE_INTEGER + 1)).toThrow(
        /out of range/,
      );
    });
  });

  describe("decimal conversion", () => {
    it("should format uint64 values without bigint", () => {
      expect(formatUint64(0, 0)).toBe("0");
      expect(formatUint64(0, 5)).toBe("5");
      expect(formatUint64(0, 0xffff_ffff)).toBe("4294967295");
      expect(formatUint64(1, 0)).toBe("4294967296");
      expect(formatUint64(0x20_0000, 0)).toBe("9007199254740992");
      expect(formatUint64(0, 2_559_999_999)).toBe("2559999999");
      expect(formatUint64(0xffff_ffff, 0xffff_ffff)).toBe("18446744073709551615");
    });

    it("should increment decimal strings", () => {
      expect(incrementDecimal("0")).toBe("1");
      expect(incrementDecimal("8")).toBe("9");
      expect(incrementDecimal("19")).toBe("20");
      expect(incrementDecimal("199")).toBe("200");
      expect(incrementDecimal("999")).toBe("1000");
    });
  });

  describe("indefinite-length string chunks", () => {
    it("should reject a chunk of the other string type", () => {
      expect(() => decodeCBOR(decodeHex("5f6161ff"))).toThrow(/wrong type/);
      expect(() => decodeCBOR(decodeHex("7f4161ff"))).toThrow(/wrong type/);
    });

    it("should reject an indefinite-length chunk", () => {
      expect(() => decodeCBOR(decodeHex("5f5f4101ffff"))).toThrow(/must be definite-length/);
      expect(() => decodeCBOR(decodeHex("7f7f6161ffff"))).toThrow(/must be definite-length/);
    });

    it("should reject a string longer than the input", () => {
      expect(() => decodeCBOR(decodeHex("450102"))).toThrow(/unexpected end/);
      expect(() => decodeCBOR(decodeHex("7affffffff"))).toThrow(/unexpected end/);
    });
  });

  describe("decodeString indefinite length", () => {
    it("should decode concatenated text chunks when chunks are concatenated", () => {
      expect(decodeCBOR(decodeHex("7f61616162ff"))).toBe("ab");
    });

    it("should reject an unterminated text chunk when terminator is missing", () => {
      expect(() => decodeCBOR(decodeHex("7f6161"))).toThrow(/unexpected end/);
    });
  });

  describe("decodeByteString indefinite length", () => {
    it("should reject an unterminated byte string when terminator is missing", () => {
      expect(() => decodeCBOR(decodeHex("5f4101"))).toThrow(/unexpected end/);
    });
  });

  describe("array decoding errors", () => {
    it("should reject an unterminated indefinite array when terminator is missing", () => {
      expect(() => decodeCBOR(decodeHex("9f"))).toThrow(/unexpected end/);
    });

    it("should reject a fixed array shorter than its declared length when items are missing", () => {
      expect(() => decodeCBOR(decodeHex("8201"))).toThrow(/unexpected end/);
    });
  });

  describe("indefinite map decoding errors", () => {
    it("should reject a key without a value when value is missing", () => {
      expect(() => decodeCBOR(decodeHex("bf01"))).toThrow(/unexpected end/);
    });

    it("should reject non string/number keys when key type is invalid", () => {
      expect(() => decodeCBOR(decodeHex("bf8001ff"))).toThrow(/map key must be/);
    });

    it("should reject duplicate keys when keys repeat", () => {
      expect(() => decodeCBOR(decodeHex("bf616101616102ff"))).toThrow(/duplicate map key/);
    });

    it("should reject an unterminated map when terminator is missing", () => {
      expect(() => decodeCBOR(decodeHex("bf616101"))).toThrow(/unexpected end/);
    });
  });

  describe("fixed map decoding errors", () => {
    it("should reject a missing key when map is truncated", () => {
      expect(() => decodeCBOR(decodeHex("a1"))).toThrow(/unexpected end/);
    });

    it("should reject a key without a value when value is missing", () => {
      expect(() => decodeCBOR(decodeHex("a16161"))).toThrow(/unexpected end/);
    });

    it("should reject non string/number keys when key type is invalid", () => {
      expect(() => decodeCBOR(decodeHex("a18001"))).toThrow(/map key must be/);
    });

    it("should reject duplicate keys when keys repeat", () => {
      expect(() => decodeCBOR(decodeHex("a2616101616102"))).toThrow(/duplicate map key/);
    });
  });

  describe("float decoding errors", () => {
    it("should reject truncated floats when bytes are missing", () => {
      expect(() => decodeCBOR(decodeHex("f9"))).toThrow(/unexpected end/);
      expect(() => decodeCBOR(decodeHex("fa"))).toThrow(/unexpected end/);
      expect(() => decodeCBOR(decodeHex("fb"))).toThrow(/unexpected end/);
    });

    it("should reject unsupported float16 values when value is subnormal", () => {
      expect(() => decodeCBOR(decodeHex("f90000"))).toThrow(/float16/);
    });
  });

  describe("decodeNext streaming errors", () => {
    it("should reject a tag with a missing value when tag value is missing", () => {
      expect(() => decodeCBOR(decodeHex("c0"))).toThrow(/unexpected end/);
    });

    it("should reject unsupported simple values when value is unknown", () => {
      expect(() => decodeCBOR(decodeHex("f0"))).toThrow(/unsupported simple value/);
    });
  });
});
