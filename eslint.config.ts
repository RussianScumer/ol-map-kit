import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

export default defineConfig(
  {
    name: 'app/files-to-ignore',
    ignores: ['dist/**', 'coverage/**'],
  },

  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts}'],
    // Type-aware: the project service resolves each file through the `tsconfig.json` project
    // references (app, node, vitest), so specs and configs are linted against the same types
    // `pnpm type-check` uses.
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Omitting a key by naming it beside a rest property is the idiom for stripping it; the
      // binding exists to be discarded, and an underscore says so.
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true, varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
)
