import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  projects: [
    { name: 'desktop-1280', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'desktop-1440', use: { viewport: { width: 1440, height: 900 } } },
  ],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
  },
});
