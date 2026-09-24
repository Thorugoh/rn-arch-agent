// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['**/node_modules/**', '**/.todo/**', 'apps/mobile/**'] },
  {
    files: ['**/*.{js,mjs,ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
  {
    // Headless-first guardrail: core must run in plain Node *and* in React Native.
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['react', 'react-*', 'react-native', 'react-native-*', 'expo', 'expo-*', '@expo/*', 'node:*', 'fs', 'path', 'os', 'crypto'],
          message: 'packages/core must stay headless and platform-free. Put platform code behind a port (src/ports.ts).',
        }],
      }],
    },
  },
);
