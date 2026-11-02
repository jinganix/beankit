import { describe, expect, it } from "vitest";

// The default entry point must parse and run on runtimes without BigInt.
// These are the only BigInt hazards in source: a `BigInt(...)` call crashes
// at runtime when reached, and a `10n` literal crashes at parse time.
const sources = Object.entries(
  import.meta.glob("./*.ts", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
)
  .filter(([file]) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
  .map(([file, text]) => ({ file, text }));

describe("bigint-free default entry point", () => {
  it("should not call the BigInt global outside bigint.ts", () => {
    for (const { file, text } of sources) {
      if (file.endsWith("bigint.ts")) {
        continue;
      }
      expect(text, file).not.toMatch(/\bBigInt\s*\(/);
    }
  });

  it("should not use bigint literals outside bigint.ts", () => {
    for (const { file, text } of sources) {
      if (file.endsWith("bigint.ts")) {
        continue;
      }
      expect(text, file).not.toMatch(/\d+n\b/);
    }
  });

  it("should keep bigint support out of the default import graph", () => {
    const index = sources.find((source) => source.file.endsWith("index.ts"))?.text;
    expect(index).toBeDefined();
    expect(index).not.toContain("./bigint");
  });
});
