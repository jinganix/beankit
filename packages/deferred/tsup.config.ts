import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: { compilerOptions: { ignoreDeprecations: "6.0" } },
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  outDir: "dist",
  platform: "neutral",
  sourcemap: true,
  target: "es2022",
});
