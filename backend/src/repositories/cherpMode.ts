import { env } from '../config/env.js';

export type CherpMode = 'mock' | 'firebird';

/**
 * Fonte de verdade em runtime pra saber se os repositórios usam o Firebird real ou os mocks
 * em memória. Começa com o valor de CHERP_MODE no .env, mas pode trocar sozinho quando uma
 * conexão Firebird válida é salva pela tela de Configurações (ver `saveFirebirdSettings` em
 * settings.service.ts) — sem isso, configurar o Firebird pela UI exigiria reiniciar o processo
 * manualmente (via SSH) pra as telas passarem a mostrar dado real.
 */
let mode: CherpMode = env.CHERP_MODE;

export function getCherpMode(): CherpMode {
  return mode;
}

export function setCherpMode(next: CherpMode): void {
  mode = next;
}
