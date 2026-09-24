import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'core', include: ['packages/core/test/**/*.test.ts'] } },
      { test: { name: 'bridge', include: ['packages/bridge/test/**/*.test.ts'] } },
      { test: { name: 'cli', include: ['apps/cli/test/**/*.test.ts'] } },
    ],
  },
});
