import base from "../../eslint.config.js";

// The package entry point re-exports the sibling modules by design; the
// root `packages/*/src/index.ts` override only matches when eslint runs from
// the repository root, so restate it here relative to this package.
export default [
  ...base,
  {
    files: ["src/index.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
];
