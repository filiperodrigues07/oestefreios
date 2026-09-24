import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
    // CHERP_MODE=mock fixo: testes automatizados não podem depender de rede/banco Firebird real
    // (o .env local aponta pro CHERP de verdade desde a Fase 5 — ver README).
    // Licença/sessão única desligadas por padrão: os testes de integração logam o mesmo usuário em
    // arquivos paralelos, e um login derrubaria o outro. Os testes de licença ligam via vi.stubEnv.
    env: { NODE_ENV: 'test', CHERP_MODE: 'mock', LICENSE_MAX_SESSIONS: '0', SINGLE_SESSION_PER_USER: 'false' },
  },
});
