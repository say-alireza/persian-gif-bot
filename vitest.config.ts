import { defineConfig } from 'vitest/config';

// Pure-function tests only (no D1). DB tests need a Workers/D1 test pool; see docs/002-notes.md.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
