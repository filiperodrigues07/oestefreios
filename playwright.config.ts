import { defineConfig, devices } from '@playwright/test';

/**
 * E2E do fluxo crítico da OS, contra uma instância isolada: backend em modo mock (sem Firebird)
 * na porta 3100 e frontend Vite na 5190 — não conflita com o `npm run dev` (3000/5173).
 * Postgres: o do DATABASE_URL do ambiente (o CI sobe um próprio; localmente, o banco de dev).
 */
const API_PORT = 3100;
const WEB_PORT = 5190;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npx tsx src/server.ts',
      cwd: './backend',
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        PORT: String(API_PORT),
        CHERP_MODE: 'mock',
        LICENSE_MAX_SESSIONS: '0',
        // O teste de edição simultânea abre duas abas com o mesmo usuário.
        SINGLE_SESSION_PER_USER: 'false',
      },
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      cwd: './frontend',
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { API_PROXY_TARGET: `http://localhost:${API_PORT}` },
    },
  ],
});
