import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: resolve(projectRoot, 'demo-site'),
  base: './',
  publicDir: resolve(projectRoot, 'public'),
  build: {
    outDir: resolve(projectRoot, 'demo-dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(projectRoot, 'demo-site/index.html'),
        play: resolve(projectRoot, 'demo-site/play.html')
      }
    }
  }
});
