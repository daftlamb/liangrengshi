import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/runtime',
  build: { outDir: '../../dist', emptyOutDir: true },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { root: fileURLToPath(new URL('.', import.meta.url)), include: ['tests/**/*.test.ts'] },
});
