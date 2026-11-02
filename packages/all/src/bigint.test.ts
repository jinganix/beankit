import { describe, expect, it } from "vitest";

import { decodeCBORWithBigInt, encodeCBORWithBigInt } from "./bigint";

describe("beankit/bigint", () => {
  it("re-exports the cbor bigint codec", () => {
    expect(decodeCBORWithBigInt(encodeCBORWithBigInt(2n ** 64n - 1n))).toBe(18446744073709551615n);
  });

  it("keeps safe integers as numbers", () => {
    expect(decodeCBORWithBigInt(encodeCBORWithBigInt(5n))).toBe(5);
  });
});
