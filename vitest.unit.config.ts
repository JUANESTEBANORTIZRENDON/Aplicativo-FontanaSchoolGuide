import { defineConfig } from 'vitest/config';

// Pruebas puras (sin base de datos): algoritmos de server/domain. Se ejecutan en segundos.
export default defineConfig({
  test: {
    include: ['server/__tests__/**/*.unit.test.ts'],
    environment: 'node',
    testTimeout: 20_000,
  },
});
