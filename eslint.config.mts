import prettierPlugin from 'eslint-plugin-prettier';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    languageOptions: {
      globals: {
        ...globals.node,
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
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': ['off'], // Allow any in tests and mocks
      '@typescript-eslint/no-unused-parameters': ['off'], // Allow unused params in test mocks
      'no-console': ['off'],
      'prettier/prettier': ['error'],
      quotes: [
        'warn',
        'single',
        { avoidEscape: true, allowTemplateLiterals: true },
      ],
    },
  },
]);
