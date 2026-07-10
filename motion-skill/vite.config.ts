import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/runtime',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { root: fileURLToPath(new URL('.', import.meta.url)) },
});
