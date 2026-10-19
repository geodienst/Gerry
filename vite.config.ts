// Builds site/ into dist/, a folder of static files that any web server can host.
// Relative asset paths (base './') let the page run from a subfolder as well as from the domain root.
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'site',
  base: './',
  publicDir: 'public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    assetsInlineLimit: 0,
  },
  server: { host: '127.0.0.1', port: 8000 },
  preview: { host: '127.0.0.1', port: 8000 },
});
