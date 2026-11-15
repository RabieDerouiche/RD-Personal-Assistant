import {defineConfig} from 'vite';

/* Chemins relatifs : l'app marche à n'importe quelle adresse (GitHub Pages, Cloudflare, VPS). */
export default defineConfig({
  base: './',
  build: {
    outDir: '../web',
    emptyOutDir: true,
    target: 'safari16',
    chunkSizeWarningLimit: 900
  }
});
