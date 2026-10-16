import { defineConfig } from 'vite';

export default defineConfig({
  // Rutas absolutas: las pantallas profundas (/induccion/modulos/<modulo>/<seccion>) deben encontrar assets e imágenes.
  base: '/',
  server: {
    // El servidor solo acepta el origen http://127.0.0.1:5173 en desarrollo: si el puerto está ocupado, falla
    // en vez de saltar a otro (con otro puerto, cerrar sesión y demás acciones dan «Origen no permitido»).
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
});
