/**
 * Shopio root ESLint config (flat). Per `27-admin.md §11` / `26-themes-storefront.md §11`.
 *
 * Minimal MVP rules — TypeScript-aware + React hooks. Per-package package.json
 * lint scripts (`eslint . --max-warnings 0`) walk up to this config.
 *
 * Not enabled (Fáze 1 wave 2): import/order, prefer-const-readonly,
 * tailwind/no-custom-classname, full a11y plugin.
 */

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/drizzle/**',
      '**/build/**',
      '**/*.d.ts',
      '**/playwright-report/**',
      '**/test-results/**',
      'state/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        fetch: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        FormData: 'readonly',
        Intl: 'readonly',
        crypto: 'readonly',
        globalThis: 'readonly',
      },
    },
    rules: {
      // TS — match strict tsconfig (unused vars handled by tsc noUnusedLocals later)
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'off', // ORM + Fastify typing requires escapes
      '@typescript-eslint/no-non-null-assertion': 'off', // schema row! patterns
      'no-empty-pattern': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-useless-escape': 'warn',
    },
  },

  // Browser-side packages: window/document globals
  {
    files: [
      'apps/storefront/**/*.{ts,tsx}',
      'apps/admin/**/*.{ts,tsx}',
      'packages/ui/**/*.{ts,tsx}',
      'packages/sdk/**/*.{ts,tsx}',
    ],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        location: 'readonly',
        history: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        Element: 'readonly',
        Event: 'readonly',
        MouseEvent: 'readonly',
        KeyboardEvent: 'readonly',
        addEventListener: 'readonly',
        removeEventListener: 'readonly',
      },
    },
  },

  // React (apps/storefront, apps/admin) — hooks rules
  {
    files: [
      'apps/storefront/**/*.{ts,tsx}',
      'apps/admin/**/*.{ts,tsx}',
      'packages/ui/**/*.{ts,tsx}',
    ],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // Config files don't need strict TS
  {
    files: ['**/*.config.{js,ts,mjs,cjs}', '**/drizzle.config.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
