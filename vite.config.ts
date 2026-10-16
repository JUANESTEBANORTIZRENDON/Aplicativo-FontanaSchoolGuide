import { defineConfig } from 'vite';

export default defineConfig({
  // Rutas absolutas: las pantallas profundas (/induccion/modulos/<modulo>/<seccion>) deben encontrar assets e imágenes.
  base: '/',
  // El frontend no usa variables de entorno: sin esto, cada cambio en .env reinicia Vite (y en la unidad de red
  // ese reinicio falla con «Cannot find module ... vite.config.ts.timestamp-...»).
  envDir: false,
  // Solo index.html es entrada: las copias de otras ramas (.mergejuan, .mergemain) tienen su propio index.html.
  optimizeDeps: { entries: ['index.html'] },
  server: {
    // El servidor solo acepta el origen http://127.0.0.1:5173 en desarrollo: si el puerto está ocupado, falla
    // en vez de saltar a otro (con otro puerto, cerrar sesión y demás acciones dan «Origen no permitido»).
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
    // Carpetas que no son del frontend: vigilarlas provocaba recargas masivas y reinicios de Vite.
    watch: {
      ignored: ['**/.mergejuan/**', '**/.mergemain/**', '**/server/**', '**/server-dist/**', '**/prisma/**', '**/dist/**', '**/docs-assets/**', '**/documentacion/**', '**/.env'],
    },
  },
});
