import { afterEach, describe, expect, it, vi } from "vitest";

import type { CBORType } from "./cbor-types";
import type { TextCodecLike } from "./text-codec";

/**
 * WeChat MiniProgram (JSCore) has no global TextDecoder/TextEncoder.
 * Importing the CBOR codec must not throw at module-evaluation time,
 * and string round-trip must still work via fallback codec.
 */
describe("cbor without TextDecoder/TextEncoder", () => {
  const originalDecoder = (globalThis as Record<string, unknown>).TextDecoder;
  const originalEncoder = (globalThis as Record<string, unknown>).TextEncoder;

  afterEach(() => {
    if (originalDecoder !== undefined) {
      (globalThis as Record<string, unknown>).TextDecoder = originalDecoder;
    }
    if (originalEncoder !== undefined) {
      (globalThis as Record<string, unknown>).TextEncoder = originalEncoder;
    }
    vi.resetModules();
  });

  async function loadFreshCodec(missing: Array<"TextDecoder" | "TextEncoder">): Promise<{
    decodeCBOR: (data: DataView | Uint8Array | ArrayBuffer | ArrayBufferLike) => CBORType;
    encodeCBOR: (data: CBORType) => Uint8Array;
    getTextCodec: () => TextCodecLike;
  }> {
    for (const name of missing) {
      Reflect.deleteProperty(globalThis, name);
    }
    vi.resetModules();
    const [{ decodeCBOR }, { encodeCBOR }] = await Promise.all([
      import("./cbor-decode"),
      import("./cbor-encode"),
    ]);
    const { getTextCodec } = await import("./text-codec");
    return { decodeCBOR, encodeCBOR, getTextCodec };
  }

  it("should import and round-trip strings when globals are missing", async () => {
    const { decodeCBOR, encodeCBOR } = await loadFreshCodec(["TextDecoder", "TextEncoder"]);
    expect(decodeCBOR(encodeCBOR("hello world"))).toBe("hello world");
    expect(decodeCBOR(encodeCBOR("康养名录"))).toBe("康养名录");
    expect(decodeCBOR(encodeCBOR("café 🎉"))).toBe("café 🎉");
    expect(decodeCBOR(encodeCBOR("a𐀀b"))).toBe("a𐀀b");
    // An unpaired surrogate is not valid UTF-8: the fallback writes U+FFFD exactly
    // like TextEncoder, so the bytes never depend on which runtime encoded them.
    expect(encodeCBOR("\ud800")).toEqual(new Uint8Array([0x63, 0xef, 0xbf, 0xbd]));
    expect(decodeCBOR(encodeCBOR("a\ud800b"))).toBe("a\ufffdb");
    expect(decodeCBOR(encodeCBOR("\udc00x"))).toBe("\ufffdx");
  });

  it("should fall back when only one global is missing", async () => {
    for (const missing of [["TextDecoder"], ["TextEncoder"]] as Array<
      Array<"TextDecoder" | "TextEncoder">
    >) {
      const { decodeCBOR, encodeCBOR } = await loadFreshCodec(missing);
      expect(decodeCBOR(encodeCBOR("hello"))).toBe("hello");
    }
  });

  it("should decode replacement characters for truncated sequences", async () => {
    const { getTextCodec } = await loadFreshCodec(["TextDecoder"]);
    const decode = getTextCodec().decode;
    expect(decode(new Uint8Array([0xc3]))).toBe("�");
    expect(decode(new Uint8Array([0xe2, 0x82]))).toBe("��");
    expect(decode(new Uint8Array([0xf0, 0x9f]))).toBe("��");
  });
});
