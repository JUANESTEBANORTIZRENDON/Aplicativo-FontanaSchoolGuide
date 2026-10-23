import { defineConfig } from 'vitest/config';

// Suite de evaluaciones oficiales y certificación contra la base de pruebas (DATABASE_URL_TEST). Solo necesita
// las migraciones y el catálogo base: npx vitest run --config vitest.evaluation.config.ts
export default defineConfig({
  test: {
    include: ['server/__tests__/evaluation-flow.test.ts'],
    environment: 'node',
    globalSetup: ['server/__tests__/evaluation-setup.ts'],
    setupFiles: ['server/__tests__/setup.ts'],
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 300_000,
  },
});
