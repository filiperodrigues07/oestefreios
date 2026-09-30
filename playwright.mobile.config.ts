import { defineConfig, devices } from '@playwright/test';

/** Testes de interface mobile com API simulada; não cria registros no Postgres de desenvolvimento. */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'mobile.spec.ts',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5191',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'mobile-320', use: { ...devices['Desktop Chrome'], ...(process.env.PW_USE_INSTALLED_CHROME ? { channel: 'chrome' } : {}), viewport: { width: 320, height: 740 }, isMobile: true, hasTouch: true } },
    { name: 'mobile-390', use: { ...devices['Desktop Chrome'], ...(process.env.PW_USE_INSTALLED_CHROME ? { channel: 'chrome' } : {}), viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
