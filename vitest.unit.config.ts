import { defineConfig } from 'vitest/config';

// Pruebas puras (sin base de datos): algoritmos de server/domain. Se ejecutan en segundos.
export default defineConfig({
  test: {
    include: ['server/__tests__/**/*.unit.test.ts'],
    environment: 'node',
    // Los módulos de servidor leen la configuración al importarse; las pruebas puras no abren la base.
    env: { DATABASE_URL: 'postgresql://prueba@127.0.0.1:5432/prueba', NODE_ENV: 'test' },
    testTimeout: 20_000,
  },
});
