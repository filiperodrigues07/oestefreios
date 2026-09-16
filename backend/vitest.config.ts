import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
    // CHERP_MODE=mock fixo: testes automatizados não podem depender de rede/banco Firebird real
    // (o .env local aponta pro CHERP de verdade desde a Fase 5 — ver README).
    env: { NODE_ENV: 'test', CHERP_MODE: 'mock' },
  },
});
