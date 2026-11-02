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
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { fixStyle: "inline-type-imports", prefer: "type-imports" },
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
    // Package entry points exist purely to expose the public API.
    files: ["packages/*/src/index.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  eslintPluginPrettierRecommended,
];
