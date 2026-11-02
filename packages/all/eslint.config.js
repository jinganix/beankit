import base from "../../eslint.config.js";

// The aggregate entry point re-exports the sibling packages by design; the
// root `packages/*/src/index.ts` override only matches when eslint runs from
// the repository root, so restate it here relative to this package.
export default [
  ...base,
  {
    files: ["src/index.ts", "src/bigint.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
];
