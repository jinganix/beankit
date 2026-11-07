import eslint from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import globals from "globals";
import tseslint from "typescript-eslint";

const NO_IMPORT_EXTENSION_MESSAGE =
  "Import specifiers MUST be extensionless: no .ts (moduleResolution=Bundler resolves them).";

export default [
  {
    ignores: ["**/dist/**", "**/coverage/**", "**/node_modules/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parser: tsParser,
    },
    rules: {
      "max-len": [
        "error",
        { code: 100, ignoreStrings: true, ignoreUrls: true, ignoreTemplateLiterals: true },
      ],
      "no-restricted-syntax": [
        "error",
        {
          message: "Re-export is prohibited; import directly from the defining module.",
          selector: "ExportAllDeclaration",
        },
        {
          message: "Re-export is prohibited; import directly from the defining module.",
          selector: "ExportNamedDeclaration[source]",
        },
        {
          message: NO_IMPORT_EXTENSION_MESSAGE,
          selector: "ImportDeclaration[source.value=/\\.ts$/]",
        },
        {
          message: NO_IMPORT_EXTENSION_MESSAGE,
          selector: "ExportNamedDeclaration[source.value=/\\.ts$/]",
        },
        {
          message: NO_IMPORT_EXTENSION_MESSAGE,
          selector: "ExportAllDeclaration[source.value=/\\.ts$/]",
        },
        {
          message: NO_IMPORT_EXTENSION_MESSAGE,
          selector: "ImportExpression[source.value=/\\.ts$/]",
        },
      ],
      semi: "off",
      "sort-keys": "off",
    },
  },
  {
    // TypeScript rules apply to TypeScript files only; plain `.js`/`.mjs` (eslint
    // and script configs) would otherwise be asked for type annotations.
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { fixStyle: "inline-type-imports", prefer: "type-imports" },
      ],
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        {
          allowConciseArrowFunctionExpressionsStartingWithVoid: true,
          allowDirectConstAssertionInArrowFunctions: true,
          allowExpressions: true,
          allowHigherOrderFunctions: true,
          allowTypedFunctionExpressions: true,
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrors: "none",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // Config files re-export a shared base by design.
    files: ["**/eslint.config.js", "**/.prettierrc.cjs", "**/.prettierrc.mjs"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    // Package entry points (`index` plus the `bigint` subpath) exist purely to
    // expose the public API. The patterns are cwd-independent: workspaces run
    // eslint from their own directory.
    files: ["**/src/index.ts", "**/src/bigint.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  eslintPluginPrettierRecommended,
];
