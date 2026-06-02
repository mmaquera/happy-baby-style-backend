const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const prettier = require('eslint-config-prettier');
const globals = require('globals');

module.exports = tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      'node_modules/**',
      '.nx/**',
      '**/generated/**',
      'logs/**',
      'uploads/**',
      'scripts/**',
      '**/*.config.js',
    ],
  },
  {
    files: ['apps/**/src/**/*.ts', 'apps/**/tests/**/*.ts', 'libs/**/src/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, prettier],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Baseline no estricto: hallazgos del código heredado quedan como warning
      // para no romper el build. Endurecer a 'error' al limpiarlos (ver Fase 6 / CI).
      'no-useless-escape': 'warn',
      'prefer-const': 'warn',
      'no-case-declarations': 'warn',
      '@typescript-eslint/no-this-alias': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
    },
  },
  // --- Enforcement: per-service Prisma client isolation (item 7.13) ---
  // Direct imports from '@prisma/client' are banned in app code.
  // Each service must use its own generated client via src/prisma.ts.
  {
    files: ['apps/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@prisma/client',
              message:
                "Do not import from '@prisma/client' directly. Use the per-service client in src/prisma.ts (item 7.13).",
            },
          ],
        },
      ],
    },
  },
);
