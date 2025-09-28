import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import prettierPlugin from "eslint-plugin-prettier";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    languageOptions: {
      globals: {
        ...globals.node, // Add Node.js globals including 'process'
        ...globals.browser,
      },
    },
  },
  ...tseslint.configs.recommended,
  {
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": ["off"], // Allow any in tests and mocks
      "@typescript-eslint/no-unused-parameters": ["off"], // Allow unused params in test mocks
      "no-console": ["off"],
      "prettier/prettier": ["error"],
      quotes: [
        "warn",
        "double",
        { avoidEscape: true, allowTemplateLiterals: true },
      ],
    },
  },
]);
