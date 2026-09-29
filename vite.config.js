import { defineConfig } from 'vite';

// Caminhos relativos para o build funcionar em qualquer subpasta (ex.: GitHub Pages).
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1200 },
});
