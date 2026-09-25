import { execFileSync } from 'node:child_process';

/**
 * Versão rodando (hash curto do commit). Aparece no /api/health e nos logs de erro do frontend —
 * suporte sabe na hora qual build o cliente está usando. `APP_VERSION` no ambiente tem prioridade
 * (deploy sem pasta .git); sem git disponível, cai em "dev".
 */
function detectarVersao(): string {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
}

export const APP_VERSION = detectarVersao();
