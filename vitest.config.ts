import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'core', include: ['packages/core/test/**/*.test.ts'] } },
      { test: { name: 'node', include: ['packages/node/test/**/*.test.ts'] } },
      { test: { name: 'todo', include: ['examples/todo/*/test/**/*.test.ts'] } },
    ],
  },
});
