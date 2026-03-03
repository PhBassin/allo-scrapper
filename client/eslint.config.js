import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Enforce structured logger (src/utils/logger.ts) instead of console.*
      // The logger delegates to console.* in dev and forwards to /api/logs in prod.
      // Explicit eslint-disable-line is required for intentional console usage
      // (e.g., the logger implementation itself uses console.* in dev mode).
      'no-console': 'error',
    },
  },
])
