// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const platformImports = ['react', 'react-*', 'react-native', 'react-native-*', 'expo', 'expo-*', '@expo/*', 'node:*', 'fs', 'path', 'os', 'crypto'];

export default defineConfig(
  { ignores: ['**/node_modules/**', '**/.todo/**', '**/.expo/**', '**/dist/**', '**/ios/**', '**/android/**'] },
  {
    files: ['**/*.{js,mjs,ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
  {
    files: ['packages/react-native/**/*.{ts,tsx}', 'examples/todo/mobile/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
  },
  {
    // Headless-first guardrail: this code runs in Node *and* React Native, so it can't touch either platform.
    files: ['packages/core/src/**/*.ts', 'packages/bridge/src/**/*.ts', 'examples/todo/domain/src/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: platformImports,
          message: 'This package must stay platform-free (it runs in Node and React Native). Put platform code behind a port.',
        }],
      }],
    },
  },
);
