import { defineConfig } from "tsup";

// Deliberately below the repo default es2022. The point of this package is
// devices without BigInt (iOS <= 13, Safari 14.0, Chrome < 72): es2022 emits
// class fields, which those engines cannot parse, so the *whole* entry would
// fail. es2019 also lowers bigint literals to BigInt() calls, keeping the
// optional bigint entry parseable there too. Do not raise this.
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
