import { defineConfig } from 'vite';

export default defineConfig({
  // Rutas absolutas: las pantallas profundas (/induccion/modulos/<modulo>/<seccion>) deben encontrar assets e imágenes.
  base: '/',
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
});
