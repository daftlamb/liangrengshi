import { defineConfig } from 'playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 15_000,
  use: { headless: true },
});
