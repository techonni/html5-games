import { defineConfig } from 'vite';

// Site zunrel.com (PixiJS + GSAP + TypeScript + Howler.js), publicado à parte no Cloudflare.
export default defineConfig({
  root: 'zunrel-games',
  base: '/',
  build: {
    outDir: '../dist-zunrel',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
  },
});
