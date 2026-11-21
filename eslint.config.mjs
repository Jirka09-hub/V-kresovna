import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import i18next from 'eslint-plugin-i18next'
import tseslint from 'typescript-eslint'

const PURE_PACKAGES = [
  'packages/engine/**',
  'packages/drafting-standards/**',
  'packages/exercises/**',
]

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/.open-next/**',
      '**/.wrangler/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'apps/web/next-env.d.ts',
      'apps/web/cloudflare-env.d.ts',
      'apps/web/lib/supabase/database.types.ts',
    ],
  },
  // Next.js pravidla pro aplikaci
  ...nextVitals.map((c) => ({ ...c, files: ['apps/web/**/*.{ts,tsx}'] })),
  ...nextTs.map((c) => ({ ...c, files: ['apps/web/**/*.{ts,tsx}'] })),
  {
    settings: { next: { rootDir: 'apps/web' } },
  },
  // TypeScript pravidla pro balíčky
  ...tseslint.configs.recommended.map((c) => ({ ...c, files: ['packages/**/*.{ts,tsx}'] })),
  ...[['apps/web/**/*.{ts,tsx}'], ['packages/**/*.{ts,tsx}']].map((files) => ({
    files,
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  })),
  // Žádné texty natvrdo v JSX (vše přes next-intl)
  {
    files: ['apps/web/**/*.tsx', 'packages/viewer/**/*.tsx'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-only',
          'jsx-attributes': { include: ['alt', 'aria-label', 'title', 'placeholder'] },
          callees: { exclude: ['t', 'tv', 'require'] },
        },
      ],
    },
  },
  // Čisté balíčky nesmí záviset na UI, frameworku ani databázi
  {
    files: PURE_PACKAGES,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'react/*', '@react-three/*'],
              message: 'Čisté balíčky nesmí importovat React.',
            },
            {
              group: ['next', 'next/*', 'next-intl', 'next-intl/*'],
              message: 'Čisté balíčky nesmí importovat Next.js.',
            },
            { group: ['@supabase/*'], message: 'Čisté balíčky nesmí mluvit s databází.' },
            {
              group: ['@vykresovna/viewer', '@vykresovna/content'],
              message: 'Porušení vrstev architektury.',
            },
          ],
        },
      ],
    },
  },
)
