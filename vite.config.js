import { defineConfig } from 'vite';

// Caminhos relativos para o build funcionar em qualquer subpasta (ex.: GitHub Pages).
export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        main: 'index.html',
        trader: 'binary-options/index.html',
        monster: 'clumsy-monster/index.html',
        nhami: 'nhami/index.html',
        stakeCrash: 'stake-crash/index.html',
      },
    },
  },
});
