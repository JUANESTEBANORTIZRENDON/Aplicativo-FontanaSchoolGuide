import { defineConfig } from 'vite';

export default defineConfig({
  // Rutas relativas para poder servir el build desde cualquier carpeta.
  base: './',
  server: {
    // La carpeta está en una unidad de red: el vigilante nativo falla, así que se consulta por intervalos.
    watch: { usePolling: true, interval: 300 },
  },
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
  },
});
