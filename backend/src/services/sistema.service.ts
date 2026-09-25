import { readFile } from 'node:fs/promises';
import { env } from '../config/env.js';
import { getHealthStatus } from './health.service.js';
import { listActiveSessions } from './session.service.js';

export interface BackupStatus {
  /** ISO do fim do último backup bem-sucedido. */
  finishedAt: string;
  local: boolean;
  remote: boolean | null;
}

/** Último backup registrado pelo backup.sh; `null` se o arquivo não existe (backup nunca rodou nesta máquina). */
async function lerStatusBackup(): Promise<BackupStatus | null> {
  try {
    const dados = JSON.parse(await readFile(env.BACKUP_STATUS_FILE, 'utf8')) as Partial<BackupStatus>;
    if (typeof dados.finishedAt !== 'string') return null;
    return { finishedAt: dados.finishedAt, local: dados.local !== false, remote: dados.remote ?? null };
  } catch {
    return null;
  }
}

/**
 * Painel "Sistema" (Configurações): tudo que o administrador do cliente precisa pra saber se
 * o problema é dele (internet, Firebird desligado) antes de abrir chamado.
 */
export async function getSistemaStatus() {
  const [health, backup, sessoes] = await Promise.all([getHealthStatus(), lerStatusBackup(), listActiveSessions()]);
  return {
    ...health,
    backup,
    sessoesAtivas: sessoes.length,
    uptimeSegundos: Math.round(process.uptime()),
  };
}
