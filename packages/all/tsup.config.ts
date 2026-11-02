import { defineConfig } from "tsup";

// Matches packages/cbor: this bundle includes the CBOR codec, and es2022 class
// fields would make the whole entry unparseable on the very devices (no BigInt)
// that the BigInt-free entry exists for. Do not raise this.
export default defineConfig({
  clean: true,
  dts: { compilerOptions: { ignoreDeprecations: "6.0" } },
  entry: ["src/index.ts", "src/bigint.ts"],
  format: ["esm", "cjs"],
  outDir: "dist",
  platform: "neutral",
  sourcemap: true,
  target: "es2019",
});
