import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/__tests__/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['server/__tests__/global-setup.ts'],
    setupFiles: ['server/__tests__/setup.ts'],
    // Las suites comparten la base de pruebas: se ejecutan de una en una.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 300_000,
  },
});
