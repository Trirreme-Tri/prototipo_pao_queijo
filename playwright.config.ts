import { defineConfig, devices } from '@playwright/test';

// Mesmo caminho base do build (ver vite.config.ts). Os testes usam goto('./#/...').
const base = process.env.BASE_PATH || '/';
const url = 'http://localhost:4173' + base;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: 0,
  use: { baseURL: url, ...devices['Pixel 5'] },
  webServer: { command: 'npm run build && npm run preview -- --port 4173 --strictPort', url, reuseExistingServer: false, timeout: 120_000 },
});
