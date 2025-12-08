import eslintConfigPrettier from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Ignore patterns - MUST be first
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.git/**',
      '**/data/**',
      '**/*.config.js',
      '**/*.config.mjs',
    ],
  },
  // Base configuration
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
  },
  // TypeScript recommended rules
  ...tseslint.configs.recommended,
  // Prettier integration
  {
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      // TypeScript rules
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',

      // General rules
      'no-console': 'off',

      // Prettier integration - this will enforce your .prettierrc.json settings
      'prettier/prettier': [
        'error',
        {
          singleQuote: true, // Change to false if you chose Option B above
          trailingComma: 'all',
          endOfLine: 'auto',
          tabWidth: 2,
          printWidth: 100,
        },
      ],
    },
  },
  // Disable formatting rules that conflict with Prettier
  eslintConfigPrettier,
  // Test-specific overrides
  {
    files: ['**/*.test.ts', '**/*.spec.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
