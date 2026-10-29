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
      // `ol` has no `exports` map: under Node's ESM loader `ol/style` is a directory import and throws
      // ERR_UNSUPPORTED_DIR_IMPORT. Consumers that externalize this package (vitest, SSR) hit it.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^ol/(?!.*\\.(?:js|css)$)',
              message: "Import OpenLayers subpaths with the extension, e.g. 'ol/Map.js'.",
            },
          ],
        },
      ],
      // Omitting a key by naming it beside a rest property is the idiom for stripping it; the
      // binding exists to be discarded, and an underscore says so.
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true, varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
)
